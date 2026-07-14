export const INSPECTION_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "reviewed",
  "cancelled",
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

const TRANSITIONS: Record<InspectionStatus, ReadonlyArray<InspectionStatus>> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["reviewed"],
  reviewed: [],
  cancelled: [],
};

export function canTransition(
  from: InspectionStatus,
  to: InspectionStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses reachable from `from` in one step (drives the board's Move menu). */
export function allowedNext(
  from: InspectionStatus,
): ReadonlyArray<InspectionStatus> {
  return TRANSITIONS[from];
}

export const INSPECTION_KINDS = [
  "move_in",
  "move_out",
  "annual",
  "ad_hoc",
] as const;
export type InspectionKind = (typeof INSPECTION_KINDS)[number];
