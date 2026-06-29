/**
 * Human-operator language. Single source of truth for every database-state
 * string that gets surfaced to the operator. The goal is to read like a
 * dispatcher describing what's happening, not like a workflow engine
 * naming its enum cases.
 *
 * Rule of thumb: if a label sounds like a column value, rewrite it. If a
 * label reads like something a person would say out loud to a teammate,
 * keep it.
 */

/* -------------------- approval reasons -------------------- */

export function approvalReasonLabel(reason: string): string {
  switch (reason) {
    case "estimate_over_threshold":
      return "estimate awaiting sign-off";
    case "invoice_manager_review":
      return "invoice — manager sign-off";
    case "invoice_owner_review":
      return "invoice — owner sign-off";
    case "vendor_change":
      return "vendor swap requested";
    case "budget_exception":
      return "budget overage";
    case "scope_change":
      return "scope change";
    case "override":
      return "policy override";
    default:
      // Fall back to a humanized version of unknown reasons.
      return reason.replace(/_/g, " ");
  }
}

/* -------------------- work-order status -------------------- */

export function workOrderStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "new";
    case "triaged":
      return "triaged";
    case "assigned":
      return "assigned";
    case "scheduled":
      return "scheduled";
    case "in_progress":
      return "in progress";
    case "blocked":
      return "blocked";
    case "resolved":
      return "awaiting verify";
    case "verified":
      return "verified";
    case "closed":
      return "closed";
    case "cancelled":
      return "cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

/**
 * Tenant-facing status label. The ops cockpit keeps the full 10-state machine;
 * a resident sees plain language. `blockedReason` (set by ops when marking a
 * job blocked) splits the single internal `blocked` state into who's holding
 * it. The column doesn't exist until the resolution phase, so the arg is
 * optional and defaults to the neutral "On hold".
 */
export function tenantStatusLabel(
  status: string,
  blockedReason?: string | null,
): string {
  switch (status) {
    case "new":
    case "triaged":
      return "Submitted";
    case "assigned":
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "blocked":
      if (blockedReason === "waiting_tenant") return "Waiting on you";
      if (blockedReason === "waiting_vendor") return "Waiting on vendor";
      return "On hold";
    case "resolved":
      return "Completed — please confirm";
    case "verified":
      return "Completed";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

/** Does the resident need to do something? Drives card emphasis + sort. */
export function tenantStatusNeedsAction(
  status: string,
  blockedReason?: string | null,
): boolean {
  return status === "resolved" || (status === "blocked" && blockedReason === "waiting_tenant");
}

/**
 * Operator-language *next-action* label for a WO status. What the dispatcher
 * would type into a kanban-board card menu — "Send to vendor", not
 * "→ assigned". Used in the drawer status-action footer.
 */
export function workOrderTransitionLabel(to: string): string {
  switch (to) {
    case "triaged":
      return "Triage";
    case "assigned":
      return "Send to vendor";
    case "scheduled":
      return "Schedule";
    case "in_progress":
      return "Mark in progress";
    case "blocked":
      return "Mark blocked";
    case "resolved":
      return "Mark done";
    case "verified":
      return "Verify";
    case "closed":
      return "Close";
    case "cancelled":
      return "Cancel";
    default:
      return `→ ${to.replace(/_/g, " ")}`;
  }
}

/* -------------------- inspection status -------------------- */

export function inspectionStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "in_progress":
      return "walking";
    case "completed":
      return "awaiting review";
    case "reviewed":
      return "reviewed";
    case "cancelled":
      return "cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

/* -------------------- audit log actions -------------------- */

/**
 * How an action verb reads on the org-wide activity strip and inside
 * the drawer timeline. Reads like a dispatcher's log book.
 */
export function auditActionLabel(action: string): string {
  switch (action) {
    case "created":
      return "filed";
    case "status_changed":
      return "marked";
    case "assigned":
      return "assigned";
    case "unassigned":
      return "unassigned";
    case "comment_added":
      return "commented";
    case "attachment_uploaded":
      return "uploaded a file";
    case "approval_requested":
      return "requested sign-off";
    case "approval_decided":
      return "decided sign-off";
    case "finding_added":
      return "logged a finding";
    case "invoice_submitted":
      return "submitted an invoice";
    case "invoice_approved":
      return "approved an invoice";
    case "invoice_rejected":
      return "rejected an invoice";
    case "cost_recorded":
      return "logged a cost";
    case "spawned":
      return "spawned";
    case "override":
      return "overrode policy";
    case "coi_expiry_sweep":
      return "ran the insurance sweep";
    case "tenant_insurance_sweep":
      return "ran the renter-policy sweep";
    case "template_spawned":
      return "fired a recurring task";
    default:
      return action.replace(/_/g, " ");
  }
}

/* -------------------- notification priority -------------------- */

/**
 * Operational weight of a notification kind. Drives whether the inbox row
 * renders bold (high), normal, or muted (quiet). The discipline: don't
 * surface count, just opacity + font-weight.
 */
export function notificationKindPriority(
  kind: string,
): "high" | "standard" | "quiet" {
  switch (kind) {
    case "wo_blocked":
    case "wo_overdue":
    case "coi_expired":
    case "tenant_insurance_expired":
    case "vendor_declined":
    case "approval_decided":
      return "high";
    case "template_spawned":
    case "coi_received":
    case "tenant_insurance_received":
    case "wo_resolved":
      return "quiet";
    default:
      return "standard";
  }
}

/* -------------------- notification kinds -------------------- */

/**
 * Type-of-notification label shown as a tiny chip in /inbox rows. Operator
 * phrases — the kind column in the DB reads engineer-ish; this maps it to
 * how a teammate would describe it out loud.
 */
export function notificationKindLabel(kind: string): string {
  switch (kind) {
    case "wo_created":
      return "new ticket";
    case "wo_assigned":
      return "assigned";
    case "wo_blocked":
      return "blocked";
    case "wo_resolved":
      return "marked done";
    case "wo_verified":
      return "verified";
    case "wo_overdue":
      return "overdue";
    case "wo_completed":
      return "completed";
    case "approval_requested":
      return "needs sign-off";
    case "approval_decided":
      return "sign-off decided";
    case "comment_external":
      return "vendor comment";
    case "comment_internal":
      return "team comment";
    case "vendor_accepted":
      return "vendor accepted";
    case "vendor_declined":
      return "vendor declined";
    case "coi_expiring":
      return "insurance expiring";
    case "coi_expired":
      return "insurance expired";
    case "coi_received":
      return "insurance uploaded";
    case "tenant_insurance_received":
      return "renter policy uploaded";
    case "inspection_scheduled":
      return "inspection scheduled";
    case "inspection_in_progress":
      return "inspection started";
    case "inspection_completed":
      return "inspection done";
    case "inspection_finding":
      return "inspection finding";
    case "template_spawned":
      return "recurring spawned";
    default:
      return kind.replace(/_/g, " ");
  }
}

/* -------------------- compliance copy -------------------- */

export const COMPLIANCE_COPY = {
  /** Header on the red violations lane at top of /compliance. */
  violationsTitle: "Cannot dispatch",
  violationsAside: "missing or expired insurance",
  noActiveCoi: "no insurance on file",
  expiringCoi: "expires soon",
  expiredCoi: "expired",
} as const;
