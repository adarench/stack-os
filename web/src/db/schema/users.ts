import { pgTable, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

// Staff/technician identity, scoped to an org. Historically a mirror of the
// OAuth subject (column `clerk_user_id` now holds the Auth.js/Google subject id
// or a synthetic `local:*` id for credential-provisioned accounts).
// Vendors are NOT in this table — see /db/schema/vendor-users.ts.
export const users = pgTable(
  "users",
  {
    id: id(),
    orgId: orgId(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    // Mobile number for SMS dispatch — techs miss email, so a text on
    // new-assignment is the reliable channel. Nullable; set in admin or
    // synced from the auth provider later.
    phone: text("phone"),
    name: text("name"),
    role: text("role").notNull().default("staff"), // staff | dispatcher | manager | admin | technician

    // --- Credential auth (M1 · AUTH-*/IDN-*). Additive + nullable so existing
    // OAuth/mirror rows are untouched. Login is username OR email + password. ---
    username: text("username"),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    status: text("status").notNull().default("active"), // active | invited | deactivated

    ...timestamps,
  },
  (t) => ({
    clerkOrgUnique: uniqueIndex("users_clerk_org_unique").on(t.clerkUserId, t.orgId),
    // Unique per org where set (NULL usernames are distinct in Postgres, so
    // existing OAuth rows without a username never collide).
    usernameOrgUnique: uniqueIndex("users_username_org_unique").on(t.orgId, t.username),
    orgIdx: index("users_org_idx").on(t.orgId),
  }),
);
