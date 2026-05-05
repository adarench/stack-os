import { pgTable, text, uuid, integer, index } from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  polymorphicTargetEnum,
  attachmentKindEnum,
  actorTypeEnum,
} from "./_shared";

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    orgId: orgId(),
    targetType: polymorphicTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    kind: attachmentKindEnum("kind").notNull().default("general"),
    storageKey: text("storage_key").notNull(), // S3 key
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes"),
    filename: text("filename"),
    ordering: integer("ordering").notNull().default(0),
    uploadedByActorType: actorTypeEnum("uploaded_by_actor_type").notNull().default("user"),
    uploadedByUserId: uuid("uploaded_by_user_id"),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("attachments_org_idx").on(t.orgId),
    targetIdx: index("attachments_target_idx").on(t.targetType, t.targetId),
    kindIdx: index("attachments_kind_idx").on(t.targetType, t.targetId, t.kind, t.ordering),
  }),
);
