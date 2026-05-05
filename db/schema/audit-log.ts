import { pgTable, text, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps, polymorphicTargetEnum, actorTypeEnum } from "./_shared";

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    orgId: orgId(),
    targetType: polymorphicTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    action: text("action").notNull(), // created, status_changed, assigned, ...
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: uuid("actor_user_id"),
    diff: jsonb("diff"), // { from: {...}, to: {...} } or arbitrary event payload
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("audit_log_org_idx").on(t.orgId),
    targetIdx: index("audit_log_target_idx").on(t.targetType, t.targetId, t.createdAt),
  }),
);
