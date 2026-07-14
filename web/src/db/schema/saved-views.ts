import { pgTable, text, uuid, boolean, integer, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

/**
 * Per-user saved filter lenses for /work. A saved view captures the current
 * query string (e.g. "status=blocked&aging=1"); pinned views render as extra
 * tabs alongside the BUILTIN_VIEWS in the saved-view bar. Owner-scoped: each
 * operator manages their own — `user_id` is the internal `users.id`.
 */
export const savedViews = pgTable(
  "saved_views",
  {
    id: id(),
    orgId: orgId(),
    userId: uuid("user_id").notNull(),

    name: text("name").notNull(),
    // Raw query string for /work, e.g. "status=blocked&aging=1" (no leading "?").
    params: text("params").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("saved_views_org_idx").on(t.orgId),
    userIdx: index("saved_views_user_idx").on(t.orgId, t.userId),
  }),
);
