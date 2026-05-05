import { pgTable, text, uuid, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps, polymorphicTargetEnum, actorTypeEnum } from "./_shared";

export const comments = pgTable(
  "comments",
  {
    id: id(),
    orgId: orgId(),
    targetType: polymorphicTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    body: text("body").notNull(),
    actorType: actorTypeEnum("actor_type").notNull().default("user"),
    actorUserId: uuid("actor_user_id"), // either users.id or vendor_users.id depending on actorType
    visibility: text("visibility").notNull().default("internal"), // internal | external (visible to vendor portal)
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("comments_org_idx").on(t.orgId),
    targetIdx: index("comments_target_idx").on(t.targetType, t.targetId),
  }),
);
