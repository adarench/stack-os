import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { tenantUsers } from "@db/schema/compliance";
import { withScope } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { logger } from "./logger";
import type { TenantSession } from "./tenant-auth";

/**
 * Credential auth for Lucid residents (email + password). Tenants are
 * `tenant_users` rows; login runs before a session exists, so lookups use a
 * trusted system scope pinned to the org. Mirrors {@link verifyStaffCredentials}:
 * generic null (never reveals whether the account exists), per-account failure
 * counter + lockout. "Everybody at Lucid gets their own login" — Sam, Ben, Janet.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 min

export interface TenantSessionUser extends TenantSession {
  name: string | null;
  email: string;
}

/** Verify email + password for a resident account. */
export async function verifyTenantCredentials(
  orgId: string,
  identifier: string,
  password: string,
): Promise<TenantSessionUser | null> {
  const email = (identifier ?? "").trim().toLowerCase();
  if (!email || !password) return null;

  return withScope({ orgId, actorType: "system" }, async (tx) => {
    const [u] = await tx
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.orgId, orgId), eq(sql`lower(${tenantUsers.email})`, email)))
      .limit(1);

    // Always compare (dummy hash when no user) — no timing oracle.
    const passwordOk = await verifyPassword(password, u?.passwordHash ?? null);

    if (!u) return null;
    if (u.status === "revoked") {
      logger.warn("tenant_auth.login_blocked", { reason: "revoked", tenantUserId: u.id });
      return null;
    }
    if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
      logger.warn("tenant_auth.login_blocked", { reason: "locked", tenantUserId: u.id });
      return null;
    }
    if (!passwordOk || !u.passwordHash) {
      const failed = (u.failedLoginCount ?? 0) + 1;
      const lockedUntil = failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null;
      await tx
        .update(tenantUsers)
        .set({ failedLoginCount: failed, lockedUntil })
        .where(eq(tenantUsers.id, u.id));
      logger.warn("tenant_auth.login_failed", { tenantUserId: u.id, failed });
      return null;
    }

    await tx
      .update(tenantUsers)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(eq(tenantUsers.id, u.id));
    logger.info("tenant_auth.login_ok", { tenantUserId: u.id });
    return { orgId, tenantUserId: u.id, name: u.name, email: u.email };
  });
}

/** Set/replace a resident's password (admin-assisted / first login). Activates. */
export async function setTenantPassword(
  orgId: string,
  tenantUserId: string,
  plain: string,
): Promise<void> {
  const passwordHash = await hashPassword(plain);
  await withScope({ orgId, actorType: "system" }, (tx) =>
    tx
      .update(tenantUsers)
      .set({
        passwordHash,
        status: "active",
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerifiedAt: new Date(),
      })
      .where(and(eq(tenantUsers.orgId, orgId), eq(tenantUsers.id, tenantUserId))),
  );
}
