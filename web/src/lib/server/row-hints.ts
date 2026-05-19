import "server-only";
import { and, eq, gte, inArray, isNull, lt, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { inspections } from "@db/schema/inspections";
import type { ScopedDB } from "./db";

/**
 * Row-level memory hints. Compact phrases rendered under a row's title
 * when there's an operationally non-obvious fact about the row's
 * context. The discipline rules from Tier 3 strategy hold:
 *
 *   - Max 2 hints per row
 *   - Skip when the hint duplicates what the row already shows
 *   - Thresholds gate every signal (no "1st plumbing 60d")
 *
 * Computed in batch — three queries per page regardless of row count,
 * keyed by unit / vendor / inspection.
 */

export interface RowHint {
  text: string;
  /** Visual weight. `alert` gets the urgency-blocked tone; `note` is muted. */
  tone: "alert" | "note";
}

interface HintWoRow {
  id: string;
  unitId: string | null;
  propertyId: string | null;
  title: string;
  spawnedFromInspectionId: string | null;
  status: string;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const UNIT_RECURRENCE_MIN = 3;
const VENDOR_STRESS_MIN = 2;

export async function loadWoRowHints(
  tx: ScopedDB,
  orgId: string,
  rows: HintWoRow[],
): Promise<Map<string, RowHint[]>> {
  if (rows.length === 0) return new Map();

  const [unitInfo, vendorStress, inspectionRefs] = await Promise.all([
    loadUnitRecurrence(tx, orgId, rows),
    loadVendorStress(tx, orgId, rows),
    loadInspectionRefs(tx, orgId, rows),
  ]);

  const out = new Map<string, RowHint[]>();
  for (const r of rows) {
    const hints: RowHint[] = [];

    // 1) Unit recurrence — "3rd plumbing 90d" or "3rd at unit 90d".
    if (r.unitId) {
      const info = unitInfo.get(r.unitId);
      if (info && info.count >= UNIT_RECURRENCE_MIN) {
        const focalTrade = inferTrade(r.title);
        const useTrade =
          focalTrade && info.topTrade === focalTrade && info.topTradeCount >= 2;
        hints.push({
          text: `${ordinal(info.count)} ${useTrade ? focalTrade : "at unit"} 90d`,
          tone: info.count >= 5 ? "alert" : "note",
        });
      }
    }

    // 2) Vendor stress — skip when this row itself is the loud one
    // (operator already sees it). The hint is about the *vendor's
    // overall load*, not this row.
    const vendorId = vendorStress.get(`v:${r.id}`);
    if (typeof vendorId === "string") {
      const stressed = vendorStress.get(`s:${vendorId}`) ?? 0;
      // Exclude the focal row from the count if it's part of the stressed.
      const focalContributes =
        r.status === "blocked" || /* dueAt < now derived in caller */ false;
      const effective = focalContributes ? Number(stressed) - 1 : Number(stressed);
      if (effective >= VENDOR_STRESS_MIN) {
        hints.push({
          text: `vendor: ${effective} stressed`,
          tone: effective >= 4 ? "alert" : "note",
        });
      }
    }

    // 3) Spawned from inspection — quiet causality breadcrumb.
    if (r.spawnedFromInspectionId) {
      const ref = inspectionRefs.get(r.spawnedFromInspectionId);
      if (ref) {
        hints.push({ text: `from ${ref}`, tone: "note" });
      }
    }

    // Discipline cap.
    if (hints.length > 0) {
      out.set(r.id, hints.slice(0, 2));
    }
  }
  return out;
}

/* -------------------- unit recurrence -------------------- */

interface UnitInfo {
  count: number;
  topTrade: string | null;
  topTradeCount: number;
}

async function loadUnitRecurrence(
  tx: ScopedDB,
  orgId: string,
  rows: HintWoRow[],
): Promise<Map<string, UnitInfo>> {
  const unitIds = Array.from(
    new Set(rows.map((r) => r.unitId).filter((v): v is string => !!v)),
  );
  if (unitIds.length === 0) return new Map();

  const ninetyAgo = new Date(Date.now() - NINETY_DAYS_MS);
  const all = await tx
    .select({
      unitId: workOrders.unitId,
      title: workOrders.title,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        inArray(workOrders.unitId, unitIds),
        gte(workOrders.createdAt, ninetyAgo),
      ),
    );

  const byUnit = new Map<string, { count: number; trades: Map<string, number> }>();
  for (const w of all) {
    if (!w.unitId) continue;
    const e = byUnit.get(w.unitId) ?? { count: 0, trades: new Map() };
    e.count += 1;
    const t = inferTrade(w.title);
    if (t) e.trades.set(t, (e.trades.get(t) ?? 0) + 1);
    byUnit.set(w.unitId, e);
  }

  const out = new Map<string, UnitInfo>();
  for (const [unitId, e] of byUnit) {
    let topTrade: string | null = null;
    let topTradeCount = 0;
    for (const [trade, count] of e.trades) {
      if (count > topTradeCount) {
        topTrade = trade;
        topTradeCount = count;
      }
    }
    out.set(unitId, { count: e.count, topTrade, topTradeCount });
  }
  return out;
}

/* -------------------- vendor stress -------------------- */

/**
 * Two-layer map: `v:<woId> → vendorId` (active vendor per WO) +
 * `s:<vendorId> → stressedCount`. Returning a single map keeps the caller
 * simple. Stress = blocked status OR overdue (dueAt < now & not done).
 */
async function loadVendorStress(
  tx: ScopedDB,
  orgId: string,
  rows: HintWoRow[],
): Promise<Map<string, string | number>> {
  if (rows.length === 0) return new Map();

  // Active vendor per focal WO.
  const woIds = rows.map((r) => r.id);
  const vendorByWo = await tx
    .select({
      targetId: assignments.targetId,
      vendorId: assignments.assigneeId,
    })
    .from(assignments)
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        eq(assignments.assigneeType, "vendor"),
        inArray(assignments.targetId, woIds),
        isNull(assignments.unassignedAt),
      ),
    );

  const out = new Map<string, string | number>();
  const vendorIds = new Set<string>();
  for (const r of vendorByWo) {
    out.set(`v:${r.targetId}`, r.vendorId);
    vendorIds.add(r.vendorId);
  }
  if (vendorIds.size === 0) return out;

  // Stress per vendor — active WOs in blocked or overdue state.
  const now = new Date();
  const stressedRows = await tx
    .select({
      vendorId: assignments.assigneeId,
      n: drizzleSql<string>`count(distinct ${workOrders.id})::text`,
    })
    .from(assignments)
    .innerJoin(workOrders, eq(workOrders.id, assignments.targetId))
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        eq(assignments.assigneeType, "vendor"),
        inArray(assignments.assigneeId, Array.from(vendorIds)),
        isNull(assignments.unassignedAt),
        drizzleSql`(${workOrders.status} = 'blocked' OR (${workOrders.dueAt} < ${now} AND ${workOrders.status} NOT IN ('closed', 'cancelled', 'resolved', 'verified')))`,
      ),
    )
    .groupBy(assignments.assigneeId);

  for (const r of stressedRows) {
    out.set(`s:${r.vendorId}`, Number(r.n));
  }
  return out;
}

/* -------------------- inspection refs -------------------- */

async function loadInspectionRefs(
  tx: ScopedDB,
  orgId: string,
  rows: HintWoRow[],
): Promise<Map<string, string>> {
  const insIds = Array.from(
    new Set(
      rows
        .map((r) => r.spawnedFromInspectionId)
        .filter((v): v is string => !!v),
    ),
  );
  if (insIds.length === 0) return new Map();
  const ins = await tx
    .select({ id: inspections.id })
    .from(inspections)
    .where(and(eq(inspections.orgId, orgId), inArray(inspections.id, insIds)));
  const out = new Map<string, string>();
  for (const r of ins) {
    out.set(r.id, `INS-${r.id.slice(0, 6).toUpperCase()}`);
  }
  return out;
}

/* -------------------- helpers -------------------- */

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (k >= 11 && k <= 13) return `${n}th`;
  if (j === 1) return `${n}st`;
  if (j === 2) return `${n}nd`;
  if (j === 3) return `${n}rd`;
  return `${n}th`;
}

function inferTrade(title: string): string | null {
  const t = title.toLowerCase();
  if (/(leak|drain|plumb|toilet|faucet|sink|water heat|disposal)/.test(t)) return "plumbing";
  if (/(outlet|electric|wiring|breaker|spark|light fixture)/.test(t)) return "electrical";
  if (/(hvac|heat|furnace|filter|air condition|thermostat)/.test(t)) return "hvac";
  if (/(lock|deadbolt|key|mailbox)/.test(t)) return "locks";
  if (/(paint|drywall|wall)/.test(t)) return "paint";
  if (/(pest|ant|roach|mouse|bug)/.test(t)) return "pest";
  if (/(clean|janitor)/.test(t)) return "cleaning";
  if (/(window|door|screen)/.test(t)) return "doors";
  if (/(roof|gutter|fence|landscap|lawn)/.test(t)) return "exterior";
  if (/(appliance|fridge|stove|oven|dryer|washer|dishwasher)/.test(t)) return "appliance";
  return null;
}
