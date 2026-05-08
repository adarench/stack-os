import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  inspectionStatusEnum,
  inspectionKindEnum,
  findingSeverityEnum,
} from "./_shared";

export const inspections = pgTable(
  "inspections",
  {
    id: id(),
    orgId: orgId(),
    kind: inspectionKindEnum("kind").notNull().default("ad_hoc"),
    status: inspectionStatusEnum("status").notNull().default("scheduled"),

    propertyId: uuid("property_id"),
    unitId: uuid("unit_id"),

    inspectorUserId: uuid("inspector_user_id"),
    notes: text("notes"),

    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("inspections_org_idx").on(t.orgId),
    statusIdx: index("inspections_status_idx").on(t.orgId, t.status),
    propIdx: index("inspections_property_idx").on(t.orgId, t.propertyId),
    unitIdx: index("inspections_unit_idx").on(t.orgId, t.unitId),
  }),
);

export const inspectionFindings = pgTable(
  "inspection_findings",
  {
    id: id(),
    orgId: orgId(),
    inspectionId: uuid("inspection_id").notNull(),

    area: text("area"), // "kitchen", "bathroom_1", "exterior", etc.
    description: text("description").notNull(),
    severity: findingSeverityEnum("severity").notNull().default("observation"),
    pass: boolean("pass").notNull().default(true),

    // Set when the finding is converted to a WO at inspection completion.
    spawnedWorkOrderId: uuid("spawned_work_order_id"),

    ordering: text("ordering"), // optional sort key for the inspection form

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("inspection_findings_org_idx").on(t.orgId),
    inspectionIdx: index("inspection_findings_inspection_idx").on(t.inspectionId),
    severityIdx: index("inspection_findings_severity_idx").on(t.severity, t.pass),
  }),
);
