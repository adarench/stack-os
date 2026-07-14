import "server-only";
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql as drizzleSql,
} from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { properties } from "@db/schema/properties";
import { vendors } from "@db/schema/vendors";
import { vendorUsers } from "@db/schema/vendor-users";
import { vendorCois } from "@db/schema/compliance";
import { assignments } from "@db/schema/assignments";
import { withStaffScope } from "./db";

/**
 * Reporting v1 aggregations. Read-only, org-scoped, following the reporting.ts
 * idiom (count(*)::int + group-by + JS Map merge). Four practical lenses, not a
 * BI layer: throughput/aging, per-building volume, per-vendor load + COI state,
 * and COI compliance.
 */

const OPEN_STATUSES = ["new", "triaged", "assigned", "scheduled", "in_progress", "blocked"] as const;
const DONE_STATUSES = ["resolved", "verified", "closed"] as const;

const DAY_MS = 86_400_000;

export interface ThroughputReport {
  open: number;
  openByStatus: { status: string; n: number }[];
  openByPriority: { priority: string; n: number }[];
  completed30d: number;
  avgResolveDays: number | null;
  aging: { bucket: string; n: number }[];
}

export interface BuildingReportRow {
  id: string;
  name: string;
  open: number;
  aging: number;
}

export interface VendorReportRow {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  coiState: "active" | "expiring" | "expired" | "missing";
}

export interface CoiReport {
  active: number;
  expiring: number;
  expired: number;
  upcoming30d: number;
}

export interface ReportingSummary {
  throughput: ThroughputReport;
  byBuilding: BuildingReportRow[];
  byVendor: VendorReportRow[];
  coi: CoiReport;
}

/** Open work by status/priority, 30-day completion, avg resolve time, aging. */
export async function loadThroughputReport(now: Date = new Date()): Promise<ThroughputReport> {
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const d14 = new Date(now.getTime() - 14 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);
  const d90 = new Date(now.getTime() - 90 * DAY_MS);

  return withStaffScope(async (tx, ctx) => {
    const openWhere = and(
      eq(workOrders.orgId, ctx.orgId),
      inArray(workOrders.status, [...OPEN_STATUSES]),
    );

    const byStatus = await tx
      .select({ status: workOrders.status, n: drizzleSql<number>`count(*)::int` })
      .from(workOrders)
      .where(openWhere)
      .groupBy(workOrders.status);

    const byPriority = await tx
      .select({ priority: workOrders.priority, n: drizzleSql<number>`count(*)::int` })
      .from(workOrders)
      .where(openWhere)
      .groupBy(workOrders.priority);

    const [completedRow] = await tx
      .select({ n: drizzleSql<number>`count(*)::int` })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, ctx.orgId),
          inArray(workOrders.status, [...DONE_STATUSES]),
          isNotNull(workOrders.completedAt),
          gte(workOrders.completedAt, d30),
        ),
      );

    const [avgRow] = await tx
      .select({
        avg: drizzleSql<
          string | null
        >`avg(extract(epoch from (${workOrders.completedAt} - ${workOrders.createdAt})) / 86400.0)`,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, ctx.orgId),
          inArray(workOrders.status, [...DONE_STATUSES]),
          isNotNull(workOrders.completedAt),
          gte(workOrders.completedAt, d90),
        ),
      );

    const [agingRow] = await tx
      .select({
        b0: drizzleSql<number>`count(*) FILTER (WHERE ${workOrders.createdAt} > ${d7})::int`,
        b7: drizzleSql<number>`count(*) FILTER (WHERE ${workOrders.createdAt} <= ${d7} AND ${workOrders.createdAt} > ${d14})::int`,
        b14: drizzleSql<number>`count(*) FILTER (WHERE ${workOrders.createdAt} <= ${d14} AND ${workOrders.createdAt} > ${d30})::int`,
        b30: drizzleSql<number>`count(*) FILTER (WHERE ${workOrders.createdAt} <= ${d30})::int`,
      })
      .from(workOrders)
      .where(openWhere);

    const open = byStatus.reduce((sum, r) => sum + r.n, 0);
    const avg = avgRow?.avg != null ? Math.round(Number(avgRow.avg) * 10) / 10 : null;

    return {
      open,
      openByStatus: byStatus.map((r) => ({ status: r.status, n: r.n })),
      openByPriority: byPriority.map((r) => ({ priority: r.priority, n: r.n })),
      completed30d: completedRow?.n ?? 0,
      avgResolveDays: avg,
      aging: [
        { bucket: "0–7d", n: agingRow?.b0 ?? 0 },
        { bucket: "7–14d", n: agingRow?.b7 ?? 0 },
        { bucket: "14–30d", n: agingRow?.b14 ?? 0 },
        { bucket: "30d+", n: agingRow?.b30 ?? 0 },
      ],
    };
  });
}

/** Per-building open + aging (>7d) work-order counts. */
export async function loadBuildingReport(now: Date = new Date()): Promise<BuildingReportRow[]> {
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  return withStaffScope(async (tx, ctx) => {
    const props = await tx
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.orgId, ctx.orgId));

    const counts = await tx
      .select({
        propertyId: workOrders.propertyId,
        open: drizzleSql<number>`count(*)::int`,
        aging: drizzleSql<number>`count(*) FILTER (WHERE ${workOrders.createdAt} <= ${d7})::int`,
      })
      .from(workOrders)
      .where(
        and(eq(workOrders.orgId, ctx.orgId), inArray(workOrders.status, [...OPEN_STATUSES])),
      )
      .groupBy(workOrders.propertyId);
    const byId = new Map(counts.map((c) => [c.propertyId, c]));

    return props
      .map((p) => ({
        id: p.id,
        name: p.name,
        open: byId.get(p.id)?.open ?? 0,
        aging: byId.get(p.id)?.aging ?? 0,
      }))
      .sort((a, b) => b.open - a.open);
  });
}

/** Per-vendor assignment volume + completion, with worst-case COI state. */
export async function loadVendorReport(): Promise<VendorReportRow[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: vendors.id,
        name: vendors.name,
        assigned: drizzleSql<number>`count(*)::int`,
        completed: drizzleSql<number>`count(*) FILTER (WHERE ${workOrders.status} IN ('resolved','verified','closed'))::int`,
      })
      .from(assignments)
      .innerJoin(vendorUsers, eq(vendorUsers.id, assignments.assigneeId))
      .innerJoin(vendors, eq(vendors.id, vendorUsers.vendorId))
      .innerJoin(workOrders, eq(workOrders.id, assignments.targetId))
      .where(
        and(
          eq(assignments.orgId, ctx.orgId),
          eq(assignments.targetType, "work_order"),
          eq(assignments.assigneeType, "vendor_user"),
        ),
      )
      .groupBy(vendors.id, vendors.name);

    // Worst-case COI status per vendor (expired > expiring > active).
    const cois = await tx
      .select({ vendorId: vendorCois.vendorId, status: vendorCois.status })
      .from(vendorCois)
      .where(eq(vendorCois.orgId, ctx.orgId));
    const worst = new Map<string, "active" | "expiring" | "expired">();
    for (const c of cois) {
      const next = c.status as "active" | "expiring" | "expired";
      const cur = worst.get(c.vendorId);
      if (!cur || next === "expired" || (next === "expiring" && cur === "active")) {
        worst.set(c.vendorId, next);
      }
    }

    return rows
      .map((r): VendorReportRow => ({
        id: r.id,
        name: r.name,
        assigned: r.assigned,
        completed: r.completed,
        coiState: worst.get(r.id) ?? "missing",
      }))
      .sort((a, b) => b.assigned - a.assigned);
  });
}

/** COI compliance counts + upcoming (30-day) expirations. */
export async function loadCoiReport(now: Date = new Date()): Promise<CoiReport> {
  const up30 = new Date(now.getTime() + 30 * DAY_MS);
  return withStaffScope(async (tx, ctx) => {
    const byStatus = await tx
      .select({ status: vendorCois.status, n: drizzleSql<number>`count(*)::int` })
      .from(vendorCois)
      .where(eq(vendorCois.orgId, ctx.orgId))
      .groupBy(vendorCois.status);
    const counts = new Map(byStatus.map((r) => [r.status, r.n]));

    const [upcoming] = await tx
      .select({ n: drizzleSql<number>`count(*)::int` })
      .from(vendorCois)
      .where(
        and(
          eq(vendorCois.orgId, ctx.orgId),
          inArray(vendorCois.status, ["active", "expiring"]),
          isNotNull(vendorCois.expiresAt),
          gte(vendorCois.expiresAt, now),
          lt(vendorCois.expiresAt, up30),
        ),
      );

    return {
      active: counts.get("active") ?? 0,
      expiring: counts.get("expiring") ?? 0,
      expired: counts.get("expired") ?? 0,
      upcoming30d: upcoming?.n ?? 0,
    };
  });
}

/** The full dashboard payload — all four lenses in parallel. */
export async function loadReportingSummary(now: Date = new Date()): Promise<ReportingSummary> {
  const [throughput, byBuilding, byVendor, coi] = await Promise.all([
    loadThroughputReport(now),
    loadBuildingReport(now),
    loadVendorReport(),
    loadCoiReport(now),
  ]);
  return { throughput, byBuilding, byVendor, coi };
}
