import { pgTable, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

// Mirror of Clerk users scoped to an org. Populated via Clerk webhook.
// Vendors are NOT in this table — see /db/schema/vendor-users.ts.
export const users = pgTable(
  "users",
  {
    id: id(),
    orgId: orgId(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role").notNull().default("staff"), // staff | dispatcher | manager | admin
    ...timestamps,
  },
  (t) => ({
    clerkOrgUnique: uniqueIndex("users_clerk_org_unique").on(t.clerkUserId, t.orgId),
    orgIdx: index("users_org_idx").on(t.orgId),
  }),
);
