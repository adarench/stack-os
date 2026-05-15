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
 * How an action verb reads on the org-wide activity strip. Reads like a
 * dispatcher's log: "assigned", "added a comment", "marked blocked". The
 * activity strip prefixes this with the actor handle (@AR, system, etc.)
 * so we keep the verb itself — no subject.
 */
export function auditActionLabel(action: string): string {
  switch (action) {
    case "created":
      return "filed";
    case "status_changed":
      return "moved";
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
      return "insurance sweep";
    case "tenant_insurance_sweep":
      return "tenant insurance sweep";
    case "template_spawned":
      return "fired a recurring task";
    default:
      return action.replace(/_/g, " ");
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
