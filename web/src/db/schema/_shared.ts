import { pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";
import {
  POLYMORPHIC_TARGETS,
  ATTACHMENT_KINDS,
  ACTOR_TYPES,
  ASSIGNEE_TYPES,
  NOTIFICATION_CHANNELS,
} from "../../contracts/polymorphic";
import { WORK_ORDER_STATUSES, WORK_ORDER_KINDS, WORK_ORDER_PRIORITIES } from "../../contracts/state-machines/work-order";
import { INSPECTION_STATUSES, INSPECTION_KINDS } from "../../contracts/state-machines/inspection";
import { PROJECT_STATUSES, PROJECT_KINDS } from "../../contracts/state-machines/project";
import { APPROVAL_STATUSES } from "../../contracts/state-machines/approval";

// Postgres enums sourced from /contracts so the contract is the single source of truth.
// Adding a value: edit /contracts → generate migration → ALTER TYPE ... ADD VALUE in migration.

const tup = <T extends readonly string[]>(arr: T) =>
  arr as unknown as [T[number], ...T[number][]];

export const polymorphicTargetEnum = pgEnum("polymorphic_target", tup(POLYMORPHIC_TARGETS));
export const attachmentKindEnum = pgEnum("attachment_kind", tup(ATTACHMENT_KINDS));
export const actorTypeEnum = pgEnum("actor_type", tup(ACTOR_TYPES));
export const assigneeTypeEnum = pgEnum("assignee_type", tup(ASSIGNEE_TYPES));
export const notificationChannelEnum = pgEnum("notification_channel", tup(NOTIFICATION_CHANNELS));

export const workOrderStatusEnum = pgEnum("work_order_status", tup(WORK_ORDER_STATUSES));
export const workOrderKindEnum = pgEnum("work_order_kind", tup(WORK_ORDER_KINDS));
export const workOrderPriorityEnum = pgEnum("work_order_priority", tup(WORK_ORDER_PRIORITIES));
export const inspectionStatusEnum = pgEnum("inspection_status", tup(INSPECTION_STATUSES));
export const inspectionKindEnum = pgEnum("inspection_kind", tup(INSPECTION_KINDS));
export const projectStatusEnum = pgEnum("project_status", tup(PROJECT_STATUSES));
export const projectKindEnum = pgEnum("project_kind", tup(PROJECT_KINDS));
export const approvalStatusEnum = pgEnum("approval_status", tup(APPROVAL_STATUSES));

// Common column shorthands. Every entity table embeds these.
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const id = () => uuid("id").primaryKey().defaultRandom();
// Clerk org IDs are strings like "org_2abc...". Stored as text to match.
export const orgId = () => text("org_id").notNull();
