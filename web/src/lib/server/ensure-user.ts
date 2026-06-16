import "server-only";
import { and, eq } from "drizzle-orm";
import { users } from "@db/schema/users";
import type { ScopedDB } from "./db";

/**
 * Ensure a `users` row exists for the auth user in the active org; returns the
 * internal users.id. Idempotent. The auth provider's stable id is stored in
 * `clerk_user_id` (column kept for compatibility — it now holds the Auth.js /
 * Google subject id, not a Clerk id).
 *
 * Identity (email/name) is supplied by the caller — withStaffScope passes it
 * from the session on first request, so downstream callers that omit it always
 * hit the existing row. `users.email` is NOT NULL, so a placeholder is used
 * only in the (unexpected) case a row is created without identity.
 */
export async function ensureUserRow(
  tx: ScopedDB,
  orgId: string,
  userId: string,
  identity?: { email?: string | null; name?: string | null },
): Promise<string> {
  const existing = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.clerkUserId, userId)))
    .limit(1);
  if (existing.length > 0) return existing[0]!.id;

  const email = identity?.email ?? `${userId}@placeholder.local`;
  const name = identity?.name ?? null;
  const inserted = await tx
    .insert(users)
    .values({ orgId, clerkUserId: userId, email, name, role: "staff" })
    .returning({ id: users.id });
  return inserted[0]!.id;
}
