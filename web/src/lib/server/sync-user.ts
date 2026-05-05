import "server-only";
import { eq, and } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { users } from "@db/schema/users";
import { withStaffScope, type ScopedDB } from "./db";

/**
 * Ensure a `users` row exists for the current Clerk user in the active org.
 * Returns the internal users.id (uuid). Idempotent — safe to call on every
 * authenticated request, but cache via React's `cache()` on hot paths.
 */
export async function ensureCurrentUser(): Promise<string> {
  return withStaffScope(async (tx, ctx) => {
    return ensureUserRow(tx, ctx.orgId, ctx.userId);
  });
}

export async function ensureUserRow(
  tx: ScopedDB,
  orgId: string,
  clerkUserId: string,
): Promise<string> {
  const existing = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.clerkUserId, clerkUserId)))
    .limit(1);
  if (existing.length > 0) return existing[0]!.id;

  const u = await currentUser();
  const email =
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress ??
    "unknown@example.com";
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || null;

  const inserted = await tx
    .insert(users)
    .values({ orgId, clerkUserId, email, name, role: "staff" })
    .returning({ id: users.id });
  return inserted[0]!.id;
}

export async function currentUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("not_authenticated");
  return userId;
}
