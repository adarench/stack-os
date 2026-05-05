import { pgTable, text, index } from "drizzle-orm/pg-core";
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
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("properties_org_idx").on(t.orgId),
    extIdx: index("properties_ext_idx").on(t.orgId, t.externalId),
  }),
);
