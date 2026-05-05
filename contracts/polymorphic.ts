/**
 * Polymorphic target_type values used by shared subsystems
 * (comments, attachments, audit_log, approvals, assignments, task_scopes,
 * checklists).
 *
 * Adding a new target_type:
 *   1. Add the literal here.
 *   2. Add a CHECK constraint update to /db/rls-policies.sql or schema.
 *   3. Add an ADR in /docs/stack-ops/DECISIONS.md.
 */
export const POLYMORPHIC_TARGETS = [
  "work_order",
  "inspection",
  "inspection_finding",
  "project",
  "vendor",
  "vendor_coi",
  "tenant_insurance_policy",
  "task_template",
  "property",
  "unit",
] as const;

export type PolymorphicTarget = (typeof POLYMORPHIC_TARGETS)[number];

export const ATTACHMENT_KINDS = [
  "before_photo",
  "after_photo",
  "receipt",
  "signed_doc",
  "coi",
  "general",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const ACTOR_TYPES = ["user", "system", "inngest", "vendor"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const ASSIGNEE_TYPES = ["user", "vendor", "vendor_user"] as const;
export type AssigneeType = (typeof ASSIGNEE_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["email", "sms", "push", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
