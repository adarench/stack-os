/**
 * Compliance status — used by vendor_cois and tenant_insurance_policies.
 *
 *   active     — current and not within the expiry warning window
 *   expiring   — current but within 30 days of expires_at
 *   expired    — past expires_at; gates new vendor assignments
 *   superseded — replaced by a newer policy for the same target
 */
export const COMPLIANCE_STATUSES = [
  "active",
  "expiring",
  "expired",
  "superseded",
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_EXPIRING_WINDOW_DAYS = 30;

export function computeComplianceStatus(args: {
  effectiveAt: Date | null;
  expiresAt: Date | null;
  isSuperseded?: boolean;
  now?: Date;
}): ComplianceStatus {
  if (args.isSuperseded) return "superseded";
  const now = args.now ?? new Date();
  if (!args.expiresAt) return "active"; // no expiry → treat as active
  if (args.expiresAt.getTime() <= now.getTime()) return "expired";
  const daysUntil = (args.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (daysUntil <= COMPLIANCE_EXPIRING_WINDOW_DAYS) return "expiring";
  return "active";
}
