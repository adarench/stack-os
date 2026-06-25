import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

/**
 * Trello-style check-off items for inspections (recurring walks etc.), plus
 * reusable checklist templates that pre-fill them. Distinct from
 * inspection_findings (issues *discovered*, pass/fail) — these are planned
 * steps you tick off.
 */

/** A named, reusable checklist (e.g. "Weekly property walk"). */
export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => ({ orgIdx: index("checklist_templates_org_idx").on(t.orgId) }),
);

/** Items belonging to a checklist template. */
export const checklistTemplateItems = pgTable(
  "checklist_template_items",
  {
    id: id(),
    orgId: orgId(),
    templateId: uuid("template_id").notNull(),
    title: text("title").notNull(),
    ordering: integer("ordering").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    tmplIdx: index("checklist_template_items_template_idx").on(t.templateId),
  }),
);

/** Live check-off items on a single inspection. */
export const inspectionItems = pgTable(
  "inspection_items",
  {
    id: id(),
    orgId: orgId(),
    inspectionId: uuid("inspection_id").notNull(),
    title: text("title").notNull(),
    note: text("note"),
    ordering: integer("ordering").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: uuid("completed_by_user_id"),
    ...timestamps,
  },
  (t) => ({
    inspIdx: index("inspection_items_inspection_idx").on(t.inspectionId),
  }),
);
