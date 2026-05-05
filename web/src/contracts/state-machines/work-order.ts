/**
 * Canonical state machine for work_orders.
 *
 * UI and API both import from here. No agent invents transitions.
 * Update path: edit here → update DATA_MODEL.md + WORKFLOW_STATES.md →
 * file ADR in DECISIONS.md if a status is added/removed.
 */

export const WORK_ORDER_STATUSES = [
  "new",
  "triaged",
  "assigned",
  "scheduled",
  "in_progress",
  "blocked",
  "resolved",
  "verified",
  "closed",
  "cancelled",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

const TRANSITIONS: Record<WorkOrderStatus, ReadonlyArray<WorkOrderStatus>> = {
  new: ["triaged", "cancelled"],
  triaged: ["assigned", "cancelled"],
  assigned: ["scheduled", "in_progress", "blocked", "cancelled"],
  scheduled: ["in_progress", "blocked", "cancelled"],
  in_progress: ["blocked", "resolved", "cancelled"],
  blocked: ["assigned", "scheduled", "in_progress", "cancelled"],
  resolved: ["verified", "in_progress"],
  verified: ["closed", "in_progress"],
  closed: [],
  cancelled: [],
};

export function canTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedNext(from: WorkOrderStatus): ReadonlyArray<WorkOrderStatus> {
  return TRANSITIONS[from];
}

export const WORK_ORDER_KINDS = [
  "work_order",
  "ad_hoc",
  "unit_turn_item",
] as const;
export type WorkOrderKind = (typeof WORK_ORDER_KINDS)[number];

export const WORK_ORDER_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];
