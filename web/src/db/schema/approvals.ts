import {
  pgTable,
  text,
  uuid,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  polymorphicTargetEnum,
  approvalStatusEnum,
} from "./_shared";

export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    orgId: orgId(),
    targetType: polymorphicTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(), // e.g. "estimate_over_threshold"
    amountCents: numeric("amount_cents"),
    status: approvalStatusEnum("status").notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id"),
    decidedByUserId: uuid("decided_by_user_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("approvals_org_idx").on(t.orgId),
    targetIdx: index("approvals_target_idx").on(t.targetType, t.targetId),
    statusIdx: index("approvals_status_idx").on(t.orgId, t.status),
  }),
);
