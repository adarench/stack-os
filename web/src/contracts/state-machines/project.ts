export const PROJECT_STATUSES = [
  "planning",
  "active",
  "punch_list",
  "closing",
  "closed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const TRANSITIONS: Record<ProjectStatus, ReadonlyArray<ProjectStatus>> = {
  planning: ["active", "cancelled"],
  active: ["punch_list", "cancelled"],
  punch_list: ["closing", "active"],
  closing: ["closed", "punch_list"],
  closed: [],
  cancelled: [],
};

export function canTransition(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export const PROJECT_KINDS = [
  "unit_turn",
  "capex",
  "renovation",
  "make_ready",
  "general",
] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
