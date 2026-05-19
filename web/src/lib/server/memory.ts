import "server-only";
import { and, asc, desc, eq, gte, inArray, ne, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { vendors } from "@db/schema/vendors";
import { vendorUsers } from "@db/schema/vendor-users";
import { units } from "@db/schema/units";
import { tenantUsers } from "@db/schema/compliance";
import { inspections, inspectionFindings } from "@db/schema/inspections";
import { auditLog } from "@db/schema/audit-log";
import type { ScopedDB } from "./db";

/**
 * Memory layer: facts already in the database that the operator currently
 * has to remember in their head. Surfaced inline in the drawer so a row of
 * data becomes a row of *context*.
 *
 * Three discipline rules:
 *  - Never a chart, never a tile. Always compact prose.
 *  - Statistics gated on a minimum sample (no "100% on-time over 1 job").
 *  - Only render when the value is non-obvious or operationally interesting.
 */

/* -------------------- unit history -------------------- */

export interface UnitHistory {
  /** Total WOs at this unit in the last 90 days. */
  countLast90d: number;
  /** Total ever at this unit. */
  countAllTime: number;
  /** Most common kind (plumbing/electrical/etc.) inferred from titles. */
  topTradeHint: string | null;
  /** The previous WO at this unit (most-recently-resolved), if any. */
  previousResolved: {
    ref: string;
    title: string;
    resolvedAt: string;
  } | null;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Pull recurrence facts about a unit so the drawer can say
 * "3 WOs in 60d · last: WO-1023 resolved 14d ago".
 *
 * `excludeWoId` keeps the focal WO out of its own history count.
 */
export async function loadUnitHistory(
  tx: ScopedDB,
  orgId: string,
  unitId: string,
  excludeWoId: string,
): Promise<UnitHistory> {
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);

  const recentRows = await tx
    .select({
      id: workOrders.id,
      number: workOrders.number,
      title: workOrders.title,
      status: workOrders.status,
      completedAt: workOrders.completedAt,
      updatedAt: workOrders.updatedAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        eq(workOrders.unitId, unitId),
        ne(workOrders.id, excludeWoId),
        gte(workOrders.createdAt, ninetyDaysAgo),
      ),
    )
    .orderBy(desc(workOrders.createdAt))
    .limit(50);

  const allTimeRows = await tx
    .select({ n: drizzleSql<string>`count(*)::text` })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        eq(workOrders.unitId, unitId),
        ne(workOrders.id, excludeWoId),
      ),
    );

  // Infer a "topTradeHint" from titles. Cheap heuristic — we don't have
  // a trade column on work_orders; vendor assignments do but we're
  // sticking to the WO row scope here. The discipline rule: only return
  // a hint when it's actually dominant (≥40% of the recent set).
  const tradeCounts: Record<string, number> = {};
  for (const r of recentRows) {
    const t = inferTrade(r.title);
    if (t) tradeCounts[t] = (tradeCounts[t] ?? 0) + 1;
  }
  let topTradeHint: string | null = null;
  if (recentRows.length >= 3) {
    const [topTrade, count] = Object.entries(tradeCounts).sort(
      (a, b) => b[1] - a[1],
    )[0] ?? [null, 0];
    if (topTrade && count / recentRows.length >= 0.4) {
      topTradeHint = topTrade;
    }
  }

  // Previous resolved: most recent WO that reached resolved/verified/
  // closed before the focal one. Excluded from history of "still open"
  // because the operator is looking at the current one.
  const previousResolved = recentRows
    .filter((r) =>
      ["resolved", "verified", "closed"].includes(r.status as string),
    )
    .map((r) => ({
      ref: `WO-${r.number}`,
      title: r.title,
      resolvedAt: (r.completedAt ?? r.updatedAt).toISOString(),
    }))[0] ?? null;

  return {
    countLast90d: recentRows.length,
    countAllTime: Number(allTimeRows[0]?.n ?? 0),
    topTradeHint,
    previousResolved,
  };
}

/* -------------------- vendor reliability -------------------- */

export interface VendorReliability {
  vendorId: string;
  vendorName: string;
  /** WOs completed in the on-time window with a definitive outcome. */
  sampleSize: number;
  /** Fraction completed on or before dueAt. Null when sample too small. */
  onTimeRate: number | null;
  /** WOs in window where dueAt passed before completion. */
  overdueCompletions: number;
  /** Currently-active work for this vendor. */
  activeCount: number;
  /** Of the active, how many are blocked or overdue. */
  activeStressed: number;
}

const RELIABILITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SAMPLE = 5; // discipline: don't surface a rate with < 5 jobs

/**
 * Compute a vendor's recent reliability + current load. The on-time rate
 * is null until the sample crosses MIN_SAMPLE — operators should never
 * see "100% over 1 job" because that's noise, not signal.
 */
export async function loadVendorReliability(
  tx: ScopedDB,
  orgId: string,
  vendorId: string,
): Promise<VendorReliability | null> {
  const vRow = await tx
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(and(eq(vendors.orgId, orgId), eq(vendors.id, vendorId)))
    .limit(1);
  if (!vRow[0]) return null;

  const windowStart = new Date(Date.now() - RELIABILITY_WINDOW_MS);

  // Vendor's WOs — both direct vendor assignments AND vendor_user
  // assignments where the vendor_user belongs to this vendor. Resolves
  // to the same company-level view either way.
  const assigned = await tx
    .select({ targetId: assignments.targetId })
    .from(assignments)
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        drizzleSql`(${assignments.assigneeType} = 'vendor' AND ${assignments.assigneeId} = ${vendorId}) OR (${assignments.assigneeType} = 'vendor_user' AND ${vendorUsers.vendorId} = ${vendorId})`,
      ),
    );
  const woIds = assigned.map((a) => a.targetId);
  if (woIds.length === 0) {
    return {
      vendorId,
      vendorName: vRow[0].name,
      sampleSize: 0,
      onTimeRate: null,
      overdueCompletions: 0,
      activeCount: 0,
      activeStressed: 0,
    };
  }

  // Completed WOs in window — sample for the on-time rate.
  const completed = await tx
    .select({
      id: workOrders.id,
      dueAt: workOrders.dueAt,
      completedAt: workOrders.completedAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        inArray(workOrders.id, woIds),
        drizzleSql`${workOrders.status} IN ('resolved', 'verified', 'closed')`,
        gte(workOrders.completedAt, windowStart),
      ),
    );

  const sampleSize = completed.length;
  let onTime = 0;
  let overdueCompletions = 0;
  for (const c of completed) {
    if (c.dueAt && c.completedAt) {
      if (c.completedAt <= c.dueAt) onTime += 1;
      else overdueCompletions += 1;
    } else if (c.completedAt) {
      // No due date — treat as on-time so we don't penalize routine work.
      onTime += 1;
    }
  }
  const onTimeRate = sampleSize >= MIN_SAMPLE ? onTime / sampleSize : null;

  // Currently active: open WOs assigned to this vendor.
  const active = await tx
    .select({
      id: workOrders.id,
      status: workOrders.status,
      dueAt: workOrders.dueAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        inArray(workOrders.id, woIds),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'verified', 'resolved')`,
      ),
    );
  const activeCount = active.length;
  const now = new Date();
  const activeStressed = active.filter(
    (a) => a.status === "blocked" || (a.dueAt && a.dueAt < now),
  ).length;

  return {
    vendorId,
    vendorName: vRow[0].name,
    sampleSize,
    onTimeRate,
    overdueCompletions,
    activeCount,
    activeStressed,
  };
}

/* -------------------- sibling work -------------------- */

export interface SiblingWorkItem {
  ref: string;
  title: string;
  status: string;
  dueAt: string | null;
  unitLabel: string | null;
}

/**
 * Open WOs at the same property as the focal WO, excluding the focal one.
 * Operator scanning the drawer for WO-1001 should see "WO-1014 gutter
 * cleaning open at the same property" so they can batch trips or notice
 * patterns.
 */
export async function loadSiblingWork(
  tx: ScopedDB,
  orgId: string,
  propertyId: string,
  excludeWoId: string,
): Promise<SiblingWorkItem[]> {
  const rows = await tx
    .select({
      number: workOrders.number,
      title: workOrders.title,
      status: workOrders.status,
      dueAt: workOrders.dueAt,
      unitLabel: units.label,
    })
    .from(workOrders)
    .leftJoin(units, eq(units.id, workOrders.unitId))
    .where(
      and(
        eq(workOrders.orgId, orgId),
        eq(workOrders.propertyId, propertyId),
        ne(workOrders.id, excludeWoId),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'verified', 'resolved')`,
      ),
    )
    .orderBy(
      // Same status-priority sort the raw SQL had — blocked → in_progress
      // → assigned → scheduled → triaged → new — so the operator sees
      // *active* siblings first, not random ones.
      drizzleSql`case ${workOrders.status}
        when 'blocked' then 0
        when 'in_progress' then 1
        when 'assigned' then 2
        when 'scheduled' then 3
        when 'triaged' then 4
        else 5 end`,
      asc(workOrders.dueAt),
      desc(workOrders.updatedAt),
    )
    .limit(6);

  return rows.map((r) => ({
    ref: `WO-${r.number}`,
    title: r.title,
    status: r.status,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    unitLabel: r.unitLabel,
  }));
}

/* -------------------- tenant context -------------------- */

export interface TenantContext {
  name: string | null;
  email: string | null;
  /** Total WOs ever filed at this tenant's unit. Used as a proxy for
   *  resident maintenance load — operators read "5 tickets all time"
   *  before picking up the phone. */
  unitTicketCount: number;
}

/**
 * Single primary tenant per unit. Real Stack OS may have co-tenants;
 * we surface the most-recent active one (or fall back to any tenant).
 */
export async function loadTenantContext(
  tx: ScopedDB,
  orgId: string,
  unitId: string,
): Promise<TenantContext | null> {
  const t = await tx
    .select({
      id: tenantUsers.id,
      name: tenantUsers.name,
      email: tenantUsers.email,
    })
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.orgId, orgId),
        eq(tenantUsers.unitId, unitId),
        eq(tenantUsers.status, "active"),
      ),
    )
    .orderBy(desc(tenantUsers.createdAt))
    .limit(1);
  if (!t[0]) return null;
  const countRow = await tx
    .select({ n: drizzleSql<string>`count(*)::text` })
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.unitId, unitId)));
  return {
    name: t[0].name,
    email: t[0].email,
    unitTicketCount: Number(countRow[0]?.n ?? 0),
  };
}

/* -------------------- inspection lineage -------------------- */

export interface InspectionLineage {
  ref: string;
  kind: string;
  /** Findings on the spawning inspection that have NOT yet been resolved
   *  via a spawned WO completion. Operationally useful — tells the
   *  operator "the walk-through isn't done." */
  openFindingsCount: number;
}

export async function loadInspectionLineage(
  tx: ScopedDB,
  orgId: string,
  inspectionId: string,
): Promise<InspectionLineage | null> {
  const ins = await tx
    .select({ id: inspections.id, kind: inspections.kind })
    .from(inspections)
    .where(and(eq(inspections.orgId, orgId), eq(inspections.id, inspectionId)))
    .limit(1);
  if (!ins[0]) return null;
  const open = await tx
    .select({ n: drizzleSql<string>`count(*)::text` })
    .from(inspectionFindings)
    .where(
      and(
        eq(inspectionFindings.orgId, orgId),
        eq(inspectionFindings.inspectionId, ins[0].id),
        eq(inspectionFindings.pass, false),
      ),
    );
  return {
    ref: `INS-${ins[0].id.slice(0, 6).toUpperCase()}`,
    kind: ins[0].kind,
    openFindingsCount: Number(open[0]?.n ?? 0),
  };
}

/* -------------------- dispatch timeline -------------------- */

export interface DispatchEvent {
  status: string;
  at: string;
}

/**
 * Last 6 status transitions on this WO, oldest → newest. Rendered as a
 * compact dot-strip in the drawer so the operator sees the *shape* of
 * the WO's life at a glance. Not a chart — just dots + verbs.
 */
export async function loadDispatchTimeline(
  tx: ScopedDB,
  orgId: string,
  woId: string,
): Promise<DispatchEvent[]> {
  const rows = await tx
    .select({
      diff: auditLog.diff,
      at: auditLog.createdAt,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, orgId),
        eq(auditLog.targetType, "work_order"),
        eq(auditLog.targetId, woId),
        eq(auditLog.action, "status_changed"),
      ),
    )
    .orderBy(asc(auditLog.createdAt))
    .limit(6);
  const out: DispatchEvent[] = [];
  for (const r of rows) {
    const status = extractStatus(r.diff);
    if (status) out.push({ status, at: r.at.toISOString() });
  }
  return out;
}

function extractStatus(diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const d = diff as Record<string, unknown>;
  const to = d.to;
  if (typeof to === "string") return to;
  if (to && typeof to === "object") {
    const o = to as Record<string, unknown>;
    if (typeof o.status === "string") return o.status;
  }
  return null;
}

/* -------------------- helpers -------------------- */

/** Very cheap trade inference from a WO title. Used for "2 plumbing" hint. */
function inferTrade(title: string): string | null {
  const t = title.toLowerCase();
  if (/(leak|drain|plumb|toilet|faucet|sink|water heat)/.test(t)) return "plumbing";
  if (/(outlet|electric|wiring|breaker|spark|light fixture)/.test(t)) return "electrical";
  if (/(hvac|heat|furnace|filter|air condition|thermostat)/.test(t)) return "hvac";
  if (/(lock|deadbolt|key)/.test(t)) return "locksmith";
  if (/(paint|drywall|wall)/.test(t)) return "paint";
  if (/(pest|ant|roach|mouse|bug)/.test(t)) return "pest";
  if (/(clean|janitor)/.test(t)) return "cleaning";
  if (/(window|door|screen)/.test(t)) return "doors+windows";
  if (/(roof|gutter|fence|landscap|lawn)/.test(t)) return "exterior";
  if (/(appliance|fridge|stove|oven|dryer|washer|dishwasher)/.test(t)) return "appliance";
  return null;
}
