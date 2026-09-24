/**
 * Tech-facing work-order UX helpers (ops #20).
 *
 * Keeps the canonical FSM intact for board/dispatcher while presenting
 * Oscar's mobile detail path as Complete / Waiting only.
 * Waiting maps to existing `blocked`; Complete maps to `resolved`
 * (chaining through `in_progress` when needed).
 */

import {
  canTransition,
  type WorkOrderStatus,
} from "./work-order";

export type TechActionKind = "complete" | "waiting";

export type TechAction = {
  kind: TechActionKind;
  label: "Complete" | "Waiting";
  /** Ordered FSM targets applied server-side for this button. */
  path: ReadonlyArray<WorkOrderStatus>;
};

/** Friendly labels for tech detail. Board may still show raw statuses. */
export function techStatusLabel(status: WorkOrderStatus): string {
  switch (status) {
    case "blocked":
      return "Waiting";
    case "resolved":
      return "Complete";
    case "in_progress":
      return "In progress";
    default:
      return status.replace(/_/g, " ");
  }
}

/**
 * Path to Complete (`resolved`) from the current status, or null if the
 * tech cannot complete from here without office-side triage.
 */
/** Field statuses where a tech may Complete without office triage. */
const COMPLETE_ELIGIBLE: ReadonlySet<WorkOrderStatus> = new Set([
  "assigned",
  "scheduled",
  "in_progress",
  "blocked",
]);

export function completePath(
  from: WorkOrderStatus,
): ReadonlyArray<WorkOrderStatus> | null {
  if (!COMPLETE_ELIGIBLE.has(from)) return null;
  if (canTransition(from, "resolved")) return ["resolved"];
  if (
    canTransition(from, "in_progress") &&
    canTransition("in_progress", "resolved")
  ) {
    return ["in_progress", "resolved"];
  }
  return null;
}

export function canMarkWaiting(from: WorkOrderStatus): boolean {
  return canTransition(from, "blocked");
}

/** Primary tech actions for the WO detail page. */
export function techActions(from: WorkOrderStatus): ReadonlyArray<TechAction> {
  const out: TechAction[] = [];
  const complete = completePath(from);
  if (complete) {
    out.push({ kind: "complete", label: "Complete", path: complete });
  }
  if (canMarkWaiting(from)) {
    out.push({ kind: "waiting", label: "Waiting", path: ["blocked"] });
  }
  return out;
}
