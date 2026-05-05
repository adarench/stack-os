import { pgTable, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    primaryContactName: text("primary_contact_name"),
    primaryEmail: text("primary_email"),
    primaryPhone: text("primary_phone"),
    trade: text("trade"), // plumbing, electrical, hvac, general, ...
    notes: text("notes"),
    status: text("status").notNull().default("active"), // active | paused | archived
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("vendors_org_idx").on(t.orgId),
    emailUnique: uniqueIndex("vendors_email_unique").on(t.orgId, t.primaryEmail),
  }),
);
