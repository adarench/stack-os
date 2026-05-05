export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const TRANSITIONS: Record<ApprovalStatus, ReadonlyArray<ApprovalStatus>> = {
  pending: ["approved", "rejected", "expired"],
  approved: [],
  rejected: [],
  expired: [],
};

export function canTransition(
  from: ApprovalStatus,
  to: ApprovalStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}
