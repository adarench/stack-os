import "server-only";
import { and, eq, inArray, sql as drizzleSql } from "drizzle-orm";
import { projects } from "@db/schema/projects";
import { tenantUsers } from "@db/schema/compliance";
import type { ScopedDB } from "./db";

/**
 * Consequence signals — what happens downstream if this entity stays put.
 * Per docs/design/pressure_first_product_model.md, downstream consequence
 * is the highest-leverage pressure dimension after operator-personal.
 *
 * Surfaced as a row-tail chip on OVERDUE top-3 + all NEEDS YOU. Operators
 * read the chip and pick the highest-leverage row first.
 */
export interface Consequence {
  /** WO is on the critical path of an active unit-turn project. */
  delaysTurn: boolean;
  /** WO touches a unit with an active tenant. Habitability stakes. */
  tenantOccupied: boolean;
  /** Title matches life-safety keywords (leak, gas, smoke, fire, …). Trumps
   *  every other signal in chip selection. */
  lifeSafety: boolean;
  /** For approval rows: the WO ref this approval unblocks ("WO-1043"). */
  unblocksRef: string | null;
}

const EMPTY: Consequence = {
  delaysTurn: false,
  tenantOccupied: false,
  lifeSafety: false,
  unblocksRef: null,
};

/**
 * Heuristic life-safety detector. Title contains words that signal
 * habitability emergencies. Intentionally narrow — false positives erode
 * trust in the chip more than false negatives miss work.
 */
const LIFE_SAFETY_RE =
  /\b(leak|leaks|leaking|gas|smoke|fire|flood|flooding|sewage|sewer|no\s+heat|no\s+water|no\s+power|electrical\s+hazard|carbon\s+monoxide)\b/i;

interface WoRowInput {
  id: string;
  title: string;
  projectId: string | null;
  unitId: string | null;
}

/**
 * Compute consequence signals for a batch of work-order rows. Joins:
 *  - projects (for delaysTurn — kind=unit_turn AND active/planning/punch_list)
 *  - tenantUsers (for tenantOccupied — any active tenant on the unit)
 *
 * Returns a Map keyed by WO id. Rows with no signals get the EMPTY record
 * — callers can skip rendering a chip when every signal is false.
 *
 * Failure mode: if either join times out, callers see an empty map and
 * the chip silently doesn't render. The cockpit should never go down
 * because consequence is slow.
 */
export async function loadWoConsequences(
  tx: ScopedDB,
  orgId: string,
  rows: WoRowInput[],
): Promise<Map<string, Consequence>> {
  if (rows.length === 0) return new Map();

  const projectIds = Array.from(
    new Set(rows.map((r) => r.projectId).filter((id): id is string => !!id)),
  );
  const unitIds = Array.from(
    new Set(rows.map((r) => r.unitId).filter((id): id is string => !!id)),
  );

  const [turnProjectIds, occupiedUnitIds] = await Promise.all([
    projectIds.length === 0
      ? Promise.resolve(new Set<string>())
      : tx
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              eq(projects.orgId, orgId),
              inArray(projects.id, projectIds),
              eq(projects.kind, "unit_turn"),
              drizzleSql`${projects.status} IN ('planning', 'active', 'punch_list')`,
            ),
          )
          .then((rs) => new Set(rs.map((r) => r.id))),
    unitIds.length === 0
      ? Promise.resolve(new Set<string>())
      : tx
          .select({ unitId: tenantUsers.unitId })
          .from(tenantUsers)
          .where(
            and(
              eq(tenantUsers.orgId, orgId),
              inArray(tenantUsers.unitId, unitIds),
              eq(tenantUsers.status, "active"),
            ),
          )
          .then(
            (rs) =>
              new Set(
                rs
                  .map((r) => r.unitId)
                  .filter((id): id is string => !!id),
              ),
          ),
  ]);

  const map = new Map<string, Consequence>();
  for (const r of rows) {
    map.set(r.id, {
      delaysTurn: r.projectId ? turnProjectIds.has(r.projectId) : false,
      tenantOccupied: r.unitId ? occupiedUnitIds.has(r.unitId) : false,
      lifeSafety: LIFE_SAFETY_RE.test(r.title),
      unblocksRef: null,
    });
  }
  return map;
}

/**
 * Build the consequence record for an approval row. Approvals are a
 * special case — the consequence is the single WO that unblocks when the
 * approval is decided. The queue already has the WO ref; this just
 * packages it into the Consequence shape so EntityRow can render
 * uniformly.
 */
export function consequenceForApproval(woRef: string | null): Consequence {
  return { ...EMPTY, unblocksRef: woRef };
}

/**
 * Operator-leverage score. Higher = bigger downstream cascade. Used as a
 * secondary sort key on OVERDUE + NEEDS YOU so the row that unblocks the
 * most rises to the top. life-safety > delays-turn > tenant > unblocks 1.
 */
export function consequenceScore(c: Consequence | undefined): number {
  if (!c) return 0;
  let s = 0;
  if (c.lifeSafety) s += 8;
  if (c.delaysTurn) s += 4;
  if (c.tenantOccupied) s += 2;
  if (c.unblocksRef) s += 1;
  return s;
}

/**
 * Pick the chip label for a consequence — highest-stakes signal wins.
 * Returns null when there's nothing to show.
 */
export function consequenceChipLabel(c: Consequence | undefined): string | null {
  if (!c) return null;
  if (c.lifeSafety) return "life safety";
  if (c.delaysTurn) return "delays turn";
  if (c.unblocksRef) return `unblocks ${c.unblocksRef}`;
  if (c.tenantOccupied) return "tenant";
  return null;
}
