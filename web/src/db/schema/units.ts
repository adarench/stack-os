import { pgTable, text, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";
import { properties } from "./properties";

export const units = pgTable(
  "units",
  {
    id: id(),
    orgId: orgId(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    externalId: text("external_id"),
    label: text("label").notNull(), // e.g. "Apt 3B"
    bedrooms: text("bedrooms"),
    bathrooms: text("bathrooms"),
    squareFeet: text("square_feet"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("units_org_idx").on(t.orgId),
    propIdx: index("units_property_idx").on(t.propertyId),
    extUnique: uniqueIndex("units_ext_unique").on(t.orgId, t.propertyId, t.externalId),
  }),
);
