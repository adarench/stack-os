import { pgTable, text, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";
import { vendors } from "./vendors";

/**
 * Vendor identities. Separate from Clerk users — vendors get magic-link auth
 * via Resend so they can serve multiple property managers without a Clerk org
 * per relationship.
 *
 * org_id here is the property-manager org that granted the vendor access.
 * A single human vendor can have multiple rows (one per granting org).
 */
export const vendorUsers = pgTable(
  "vendor_users",
  {
    id: id(),
    orgId: orgId(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    magicLinkTokenHash: text("magic_link_token_hash"), // sha256 of issued token
    magicLinkExpiresAt: timestamp("magic_link_expires_at", { withTimezone: true }),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    status: text("status").notNull().default("invited"), // invited | active | revoked
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("vendor_users_org_idx").on(t.orgId),
    vendorIdx: index("vendor_users_vendor_idx").on(t.vendorId),
    emailUnique: uniqueIndex("vendor_users_email_unique").on(t.orgId, t.vendorId, t.email),
  }),
);
