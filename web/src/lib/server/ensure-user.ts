import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { users } from "@db/schema/users";
import type { ScopedDB } from "./db";

/**
 * Ensure a `users` row exists for the auth user in the active org; returns the
 * internal users.id. Idempotent + **canonical by email**.
 *
 * `clerk_user_id` holds the auth provider's subject (Auth.js/Google subject or a
 * `local:*` credential id). A person can present *different* subjects over time
 * (Google re-consent, or Google vs. credential login), which previously spawned
 * a NEW row per subject → duplicate identities. We now:
 *   1. match by subject (fast path),
 *   2. else reconcile by email — adopt the existing account and point its
 *      subject at the current one, so every login lands on the same row,
 *   3. else create.
 * The `users_email_lower_org_unique` index enforces one account per email/org.
 */
export async function ensureUserRow(
  tx: ScopedDB,
  orgId: string,
  userId: string,
  identity?: { email?: string | null; name?: string | null },
): Promise<string> {
  // 1. By auth subject.
  const bySubject = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.clerkUserId, userId)))
    .limit(1);
  if (bySubject.length > 0) return bySubject[0]!.id;

  const email = identity?.email?.trim().toLowerCase() ?? null;

  // 2. Reconcile by email — the canonical key. Prevents a duplicate when the
  //    same person returns with a different subject.
  if (email) {
    const byEmail = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(sql`lower(${users.email})`, email)))
      .limit(1);
    if (byEmail.length > 0) {
      await tx
        .update(users)
        .set({ clerkUserId: userId, ...(identity?.name ? { name: identity.name } : {}) })
        .where(eq(users.id, byEmail[0]!.id));
      return byEmail[0]!.id;
    }
  }

  // 3. Truly new.
  const insertEmail = identity?.email ?? `${userId}@placeholder.local`;
  const inserted = await tx
    .insert(users)
    .values({ orgId, clerkUserId: userId, email: insertEmail, name: identity?.name ?? null, role: "staff" })
    // Only possible conflict here is the email-lower unique index (a race) — the
    // subject was already checked absent. Swallow it and re-read the winner.
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (inserted.length > 0) return inserted[0]!.id;

  // Lost a race on the email unique index — re-read the winner.
  const [winner] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(sql`lower(${users.email})`, insertEmail.toLowerCase())))
    .limit(1);
  return winner!.id;
}
