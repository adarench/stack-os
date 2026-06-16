import { pgTable, text, uuid, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

export const properties = pgTable(
  "properties",
  {
    id: id(),
    orgId: orgId(),
    externalId: text("external_id"), // for AppFolio / Yardi sync later
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country").default("US"),
    timezone: text("timezone").notNull().default("America/New_York"),
    // The technician who covers this building. New work orders on this
    // property auto-assign to this user — "assign it to who's over that
    // building" — so nothing ever lands Unassigned. Nullable until set.
    defaultAssigneeUserId: uuid("default_assignee_user_id"),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("properties_org_idx").on(t.orgId),
    extIdx: index("properties_ext_idx").on(t.orgId, t.externalId),
  }),
);
