import { pgTable, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  id,
  orgId,
  timestamps,
  polymorphicTargetEnum,
  assigneeTypeEnum,
} from "./_shared";

export const assignments = pgTable(
  "assignments",
  {
    id: id(),
    orgId: orgId(),
    targetType: polymorphicTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    assigneeType: assigneeTypeEnum("assignee_type").notNull(),
    assigneeId: uuid("assignee_id").notNull(),
    assignedByUserId: uuid("assigned_by_user_id"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("assignments_org_idx").on(t.orgId),
    targetIdx: index("assignments_target_idx").on(t.targetType, t.targetId),
    assigneeIdx: index("assignments_assignee_idx").on(t.assigneeType, t.assigneeId),
    activeUnique: uniqueIndex("assignments_active_unique")
      .on(t.targetType, t.targetId, t.assigneeType, t.assigneeId)
      .where(sql`unassigned_at IS NULL`),
  }),
);
