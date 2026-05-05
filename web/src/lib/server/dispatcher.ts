import "server-only";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { type WorkOrderStatus } from "@contracts/state-machines/work-order";
import { withStaffScope } from "./db";

export const DISPATCHER_STATUSES: ReadonlyArray<WorkOrderStatus> = [
  "new",
  "triaged",
  "blocked",
];

export type DispatcherTab = "all" | "new" | "triaged" | "blocked";

export interface DispatcherFilter {
  tab?: DispatcherTab;
  propertyId?: string;
}

export type DispatcherWorkOrder = typeof workOrders.$inferSelect;

export interface DispatcherData {
  rows: DispatcherWorkOrder[];
  counts: Record<DispatcherTab, number>;
}

export function isDispatcherTab(v: unknown): v is DispatcherTab {
  return v === "all" || v === "new" || v === "triaged" || v === "blocked";
}

export async function loadDispatcher(filter: DispatcherFilter = {}): Promise<DispatcherData> {
  const tab: DispatcherTab = filter.tab ?? "all";
  return withStaffScope(async (tx, ctx) => {
    const baseConds: SQL[] = [
      eq(workOrders.orgId, ctx.orgId),
      inArray(workOrders.status, DISPATCHER_STATUSES as WorkOrderStatus[]),
    ];
    if (filter.propertyId) baseConds.push(eq(workOrders.propertyId, filter.propertyId));
    const tabConds: SQL[] = [...baseConds];
    if (tab !== "all") tabConds.push(eq(workOrders.status, tab));

    // Pull oldest-first from DB; we re-sort by priority below so urgent
    // floats to the top within an age-tie. (Postgres string ordering on the
    // priority enum doesn't match urgent→high→normal→low.)
    const rows = await tx
      .select()
      .from(workOrders)
      .where(and(...tabConds))
      .orderBy(asc(workOrders.createdAt))
      .limit(300);

    const sorted = sortByPriorityThenAge(rows);

    const allRows = tab === "all"
      ? rows
      : await tx
          .select()
          .from(workOrders)
          .where(and(...baseConds))
          .orderBy(asc(workOrders.createdAt))
          .limit(500);
    const counts = countByStatus(allRows);

    return { rows: sorted, counts };
  });
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function sortByPriorityThenAge(
  rows: DispatcherWorkOrder[],
): DispatcherWorkOrder[] {
  return rows.slice().sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 99;
    const pb = PRIORITY_RANK[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function countByStatus(rows: DispatcherWorkOrder[]): Record<DispatcherTab, number> {
  const counts: Record<DispatcherTab, number> = {
    all: rows.length,
    new: 0,
    triaged: 0,
    blocked: 0,
  };
  for (const r of rows) {
    if (r.status === "new") counts.new += 1;
    else if (r.status === "triaged") counts.triaged += 1;
    else if (r.status === "blocked") counts.blocked += 1;
  }
  return counts;
}
