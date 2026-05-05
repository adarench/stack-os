import { pgTable, uuid, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps, polymorphicTargetEnum } from "./_shared";
import { properties } from "./properties";
import { units } from "./units";

/**
 * Polymorphic multi-unit / multi-property scope for any task-like target
 * (work_order, inspection, project). A roof job covers 12 units → 12 rows.
 * The target's primary property_id/unit_id remain authoritative for UX,
 * but task_scopes are the source of truth for "what does this touch?"
 */
export const taskScopes = pgTable(
  "task_scopes",
  {
    id: id(),
    orgId: orgId(),
    targetType: polymorphicTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id").references(() => units.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("task_scopes_org_idx").on(t.orgId),
    targetIdx: index("task_scopes_target_idx").on(t.targetType, t.targetId),
    propIdx: index("task_scopes_property_idx").on(t.propertyId),
    unitIdx: index("task_scopes_unit_idx").on(t.unitId),
  }),
);
