import {
  pgTable,
  text,
  uuid,
  timestamp,
  doublePrecision,
  index,
  integer,
} from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  workOrderStatusEnum,
  workOrderKindEnum,
  workOrderPriorityEnum,
} from "./_shared";
import { properties } from "./properties";
import { units } from "./units";

export const workOrders = pgTable(
  "work_orders",
  {
    id: id(),
    orgId: orgId(),
    // Display number per org, e.g. WO-1043. Generated app-side.
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    kind: workOrderKindEnum("kind").notNull().default("work_order"),
    status: workOrderStatusEnum("status").notNull().default("new"),
    priority: workOrderPriorityEnum("priority").notNull().default("normal"),

    // Primary scope (broadened to multi-unit via task_scopes when needed).
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id").references(() => units.id, { onDelete: "restrict" }),

    // Optional grouping containers.
    parentWorkOrderId: uuid("parent_work_order_id"),
    projectId: uuid("project_id"),
    spawnedFromInspectionId: uuid("spawned_from_inspection_id"),
    spawnedFromFindingId: uuid("spawned_from_finding_id"),

    // Scheduling
    dueAt: timestamp("due_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Field check-in (cheap to add now, used in P1 mobile UX).
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkInLat: doublePrecision("check_in_lat"),
    checkInLng: doublePrecision("check_in_lng"),

    // Created-by audit (actor recorded in audit_log too).
    createdByUserId: uuid("created_by_user_id"),
    createdByActorType: text("created_by_actor_type").notNull().default("user"),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("work_orders_org_idx").on(t.orgId),
    statusIdx: index("work_orders_status_idx").on(t.orgId, t.status),
    propIdx: index("work_orders_property_idx").on(t.orgId, t.propertyId),
    unitIdx: index("work_orders_unit_idx").on(t.orgId, t.unitId),
    parentIdx: index("work_orders_parent_idx").on(t.parentWorkOrderId),
    projectIdx: index("work_orders_project_idx").on(t.projectId),
    inspectionIdx: index("work_orders_inspection_idx").on(t.spawnedFromInspectionId),
    numberIdx: index("work_orders_number_idx").on(t.orgId, t.number),
  }),
);
