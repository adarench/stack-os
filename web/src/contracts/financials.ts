/** Cost line-item kinds. */
export const COST_KINDS = ["labor", "materials", "fee", "other"] as const;
export type CostKind = (typeof COST_KINDS)[number];

/** Invoice state machine. NOT a GL — these are status flags only. */
export const INVOICE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "paid",
  "disputed",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const INVOICE_TRANSITIONS: Record<InvoiceStatus, ReadonlyArray<InvoiceStatus>> = {
  draft: ["submitted", "void"],
  submitted: ["approved", "disputed", "void"],
  approved: ["paid", "disputed", "void"],
  paid: ["disputed"],
  disputed: ["submitted", "approved", "void"],
  void: [],
};

export function canInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

/**
 * Approval thresholds in cents. Defaults — per-org override deferred.
 *
 *   < $500    → auto-approve on submission (no approval row created)
 *   $500-5K   → manager approval needed
 *   > $5K     → owner approval needed
 */
export const APPROVAL_THRESHOLDS = {
  autoApproveMaxCents: 500_00,
  managerMaxCents: 5_000_00,
} as const;

export type ApprovalLevel = "auto" | "manager" | "owner";

export function approvalLevelFor(amountCents: number): ApprovalLevel {
  if (amountCents <= APPROVAL_THRESHOLDS.autoApproveMaxCents) return "auto";
  if (amountCents <= APPROVAL_THRESHOLDS.managerMaxCents) return "manager";
  return "owner";
}
