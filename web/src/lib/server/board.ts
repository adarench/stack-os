import "server-only";
import { and, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
  type WorkOrderPriority,
} from "@contracts/state-machines/work-order";
import { withStaffScope } from "./db";
import { ensureUserRow } from "./sync-user";

export interface BoardFilters {
  propertyId?: string;
  priority?: WorkOrderPriority;
  view?: "all" | "dispatcher" | "mine";
  includeArchived?: boolean;
}

export type BoardWorkOrder = typeof workOrders.$inferSelect;

export interface BoardData {
  byStatus: Record<WorkOrderStatus, BoardWorkOrder[]>;
  total: number;
  filters: BoardFilters;
}

export const DEFAULT_BOARD_COLUMNS: WorkOrderStatus[] = [
  "new",
  "triaged",
  "assigned",
  "scheduled",
  "in_progress",
  "blocked",
  "resolved",
  "verified",
];

export const ARCHIVED_BOARD_COLUMNS: WorkOrderStatus[] = ["closed", "cancelled"];

export function emptyBoard(): Record<WorkOrderStatus, BoardWorkOrder[]> {
  const out = {} as Record<WorkOrderStatus, BoardWorkOrder[]>;
  for (const s of WORK_ORDER_STATUSES) out[s] = [];
  return out;
}

export function isBoardPriority(v: unknown): v is WorkOrderPriority {
  return typeof v === "string" && WORK_ORDER_PRIORITIES.includes(v as WorkOrderPriority);
}

/**
 * Group a flat list of work orders by status. Pure helper — used by tests
 * too, so it doesn't depend on any drizzle/runtime state.
 */
export function groupByStatus(
  rows: BoardWorkOrder[],
): Record<WorkOrderStatus, BoardWorkOrder[]> {
  const out = emptyBoard();
  for (const w of rows) out[w.status as WorkOrderStatus].push(w);
  return out;
}

export async function loadBoard(filters: BoardFilters = {}): Promise<BoardData> {
  return withStaffScope(async (tx, ctx) => {
    const me = await ensureUserRow(tx, ctx.orgId, ctx.userId);

    const statuses = filters.includeArchived
      ? [...DEFAULT_BOARD_COLUMNS, ...ARCHIVED_BOARD_COLUMNS]
      : DEFAULT_BOARD_COLUMNS;

    const conds: SQL[] = [
      eq(workOrders.orgId, ctx.orgId),
      inArray(workOrders.status, statuses),
    ];
    if (filters.propertyId) conds.push(eq(workOrders.propertyId, filters.propertyId));
    if (filters.priority) conds.push(eq(workOrders.priority, filters.priority));

    if (filters.view === "dispatcher") {
      // "Needs dispatch" — anything not yet handed off.
      const unassignedExpr = or(
        eq(workOrders.status, "new"),
        eq(workOrders.status, "triaged"),
        eq(workOrders.status, "blocked"),
      );
      if (unassignedExpr) conds.push(unassignedExpr);
    }

    if (filters.view === "mine") {
      conds.push(eq(workOrders.createdByUserId, me));
    }

    const rows = await tx
      .select()
      .from(workOrders)
      .where(and(...conds))
      .orderBy(desc(workOrders.priority), desc(workOrders.createdAt))
      .limit(500);

    return {
      byStatus: groupByStatus(rows),
      total: rows.length,
      filters,
    };
  });
}

/** Dispatcher-specific list (alternative entry that bypasses the board view). */
export async function listDispatcher(): Promise<BoardWorkOrder[]> {
  return withStaffScope(async (tx, ctx) => {
    return tx
      .select()
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, ctx.orgId),
          inArray(workOrders.status, ["new", "triaged", "blocked"]),
        ),
      )
      .orderBy(desc(workOrders.priority), desc(workOrders.createdAt))
      .limit(200);
  });
}

/**
 * "Unassigned" check — a WO is unassigned if no active assignments row exists.
 * Exposed for the dispatcher filter; lazily implemented for now via a join.
 */
export async function unassignedWorkOrderIds(): Promise<string[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .leftJoin(
        assignments,
        and(
          eq(assignments.targetType, "work_order"),
          eq(assignments.targetId, workOrders.id),
          isNull(assignments.unassignedAt),
        ),
      )
      .where(and(eq(workOrders.orgId, ctx.orgId), isNull(assignments.id)));
    return rows.map((r) => r.id);
  });
}
