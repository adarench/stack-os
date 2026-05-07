import { pgTable, text, uuid, timestamp, integer, index, boolean } from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  workOrderKindEnum,
  workOrderPriorityEnum,
} from "./_shared";

/**
 * Recurring task spec. Fires on a cron schedule (in `timezone`) and spawns
 * a `work_orders` row each time. Idempotency key is (template_id, fire_at)
 * — the spawner refuses to fire the same period twice.
 *
 * NOT a `work_orders` row itself — see ADR-002.
 */
export const taskTemplates = pgTable(
  "task_templates",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    description: text("description"),
    cron: text("cron").notNull(), // e.g. "0 9 * * 1" = Mondays 9am
    timezone: text("timezone").notNull().default("America/New_York"),
    isActive: boolean("is_active").notNull().default(true),

    // Defaults that get copied into the spawned WO.
    defaultTitle: text("default_title").notNull(),
    defaultDescription: text("default_description"),
    defaultKind: workOrderKindEnum("default_kind").notNull().default("work_order"),
    defaultPriority: workOrderPriorityEnum("default_priority").notNull().default("normal"),
    defaultPropertyId: uuid("default_property_id"),
    defaultUnitId: uuid("default_unit_id"),
    leadTimeHours: integer("lead_time_hours").notNull().default(0), // due_at = fire_at + lead_time

    // Spawn state — advanced atomically by the cron job.
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    nextFireAt: timestamp("next_fire_at", { withTimezone: true }),
    timesFired: integer("times_fired").notNull().default(0),

    createdByUserId: uuid("created_by_user_id"),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("task_templates_org_idx").on(t.orgId),
    nextFireIdx: index("task_templates_next_fire_idx").on(t.isActive, t.nextFireAt),
  }),
);

/**
 * Audit of every fire — keeps the (template_id, fire_at) idempotency
 * boundary so a re-run of the cron doesn't double-spawn.
 */
export const taskTemplateFires = pgTable(
  "task_template_fires",
  {
    id: id(),
    orgId: orgId(),
    templateId: uuid("template_id").notNull(),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    spawnedWorkOrderId: uuid("spawned_work_order_id"),
    spawnedAt: timestamp("spawned_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("task_template_fires_org_idx").on(t.orgId),
    templateIdx: index("task_template_fires_template_idx").on(t.templateId, t.fireAt),
  }),
);
