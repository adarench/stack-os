import { pgTable, text, uuid, timestamp, numeric, index } from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  projectStatusEnum,
  projectKindEnum,
} from "./_shared";

export const projects = pgTable(
  "projects",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    description: text("description"),
    kind: projectKindEnum("kind").notNull().default("general"),
    status: projectStatusEnum("status").notNull().default("planning"),

    propertyId: uuid("property_id"),
    unitId: uuid("unit_id"),

    budgetCents: numeric("budget_cents"),
    targetCompletion: timestamp("target_completion", { withTimezone: true }),

    gcUserId: uuid("gc_user_id"), // optional general contractor (Clerk-mirror)
    parentProjectId: uuid("parent_project_id"), // self-ref for sub-projects

    createdByUserId: uuid("created_by_user_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("projects_org_idx").on(t.orgId),
    statusIdx: index("projects_status_idx").on(t.orgId, t.status),
    propIdx: index("projects_property_idx").on(t.orgId, t.propertyId),
    unitIdx: index("projects_unit_idx").on(t.orgId, t.unitId),
    parentIdx: index("projects_parent_idx").on(t.parentProjectId),
  }),
);
