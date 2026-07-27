import "server-only";
import { and, eq, or, sql } from "drizzle-orm";
import { users } from "@db/schema/users";
import { withScope } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { logger } from "./logger";

/**
 * Credential auth for operators + technicians (M1 · AUTH-001/002/004/008).
 * Both are `users` rows; login runs before a session exists, so lookups use a
 * trusted system scope pinned to the org (the staff-org RLS policy admits the
 * `system` actor in-org).
 *
 * SECURITY: results never distinguish "no such account" from "wrong password"
 * (generic null). A per-account failure counter + lockout throttles brute force.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 min

export interface SessionUser {
  /** Value stored in `clerk_user_id` — the session subject `ensureUserRow` keys on. */
  subject: string;
  usersId: string;
  email: string;
  name: string | null;
  role: string;
}

/** Verify username/email + password for a staff/technician account. */
export async function verifyStaffCredentials(
  orgId: string,
  identifier: string,
  password: string,
): Promise<SessionUser | null> {
  const idn = (identifier ?? "").trim().toLowerCase();
  if (!idn || !password) return null;

  return withScope({ orgId, actorType: "system" }, async (tx) => {
    const [u] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          or(
            eq(sql`lower(${users.email})`, idn),
            eq(sql`lower(${users.username})`, idn),
          ),
        ),
      )
      .limit(1);

    // Always compare (dummy hash when no user/hash) — no timing oracle.
    const passwordOk = await verifyPassword(password, u?.passwordHash ?? null);

    if (!u) return null;
    if (u.status !== "active") {
      logger.warn("auth.login_blocked", { reason: "inactive", usersId: u.id });
      return null;
    }
    if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
      logger.warn("auth.login_blocked", { reason: "locked", usersId: u.id });
      return null;
    }
    if (!passwordOk || !u.passwordHash) {
      const failed = (u.failedLoginCount ?? 0) + 1;
      const lockedUntil = failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null;
      await tx.update(users).set({ failedLoginCount: failed, lockedUntil }).where(eq(users.id, u.id));
      logger.warn("auth.login_failed", { usersId: u.id, failed });
      return null;
    }

    // Success — reset throttle state.
    await tx
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, u.id));
    logger.info("auth.login_ok", { usersId: u.id, role: u.role });
    return {
      subject: u.clerkUserId,
      usersId: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    };
  });
}

/** Read a staff account's role by session subject (`clerk_user_id`). RBAC read. */
export async function loadStaffRole(orgId: string, subject: string): Promise<string | null> {
  return withScope({ orgId, actorType: "system" }, async (tx) => {
    const [u] = await tx
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.clerkUserId, subject)))
      .limit(1);
    return u?.role ?? null;
  });
}

/** Set/replace a staff account's password (admin-assisted reset / first login). */
export async function setStaffPassword(orgId: string, usersId: string, plain: string): Promise<void> {
  const passwordHash = await hashPassword(plain);
  await withScope({ orgId, actorType: "system" }, (tx) =>
    tx
      .update(users)
      .set({ passwordHash, status: "active", failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() })
      .where(and(eq(users.orgId, orgId), eq(users.id, usersId))),
  );
}

/** Provision a credential-backed staff/technician account. Returns users.id. */
export async function provisionStaffAccount(
  orgId: string,
  opts: { email: string; name?: string; username?: string; role?: string; password: string },
): Promise<string> {
  const passwordHash = await hashPassword(opts.password);
  const subject = `local:${crypto.randomUUID()}`;
  return withScope({ orgId, actorType: "system" }, async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        orgId,
        clerkUserId: subject,
        email: opts.email,
        name: opts.name ?? null,
        username: opts.username ?? null,
        role: opts.role ?? "staff",
        passwordHash,
        status: "active",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    return row!.id;
  });
}
