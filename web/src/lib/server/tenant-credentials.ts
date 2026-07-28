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

/**
 * Resolve which org a resident email belongs to. Single-org deployments often
 * leave STACK_ORG_ID unset/empty, so we can't rely on a caller-supplied org.
 * The `tenant_users_system_lookup` RLS policy grants the system actor an
 * org-agnostic SELECT, so we can find the account by email alone. Prefers a
 * match inside the hint org when one is given.
 */
async function resolveTenantOrg(email: string, hint: string | null): Promise<string | null> {
  const scopeOrg = hint && hint.length > 0 ? hint : "_";
  return withScope({ orgId: scopeOrg, actorType: "system" }, async (tx) => {
    if (hint && hint.length > 0) {
      const [inHint] = await tx
        .select({ orgId: tenantUsers.orgId })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.orgId, hint), eq(sql`lower(${tenantUsers.email})`, email)))
        .limit(1);
      if (inHint) return inHint.orgId;
    }
    const [any] = await tx
      .select({ orgId: tenantUsers.orgId })
      .from(tenantUsers)
      .where(eq(sql`lower(${tenantUsers.email})`, email))
      .limit(1);
    return any?.orgId ?? null;
  });
}

/**
 * Verify email + password for a resident account. `orgHint` is an optional
 * pin (STACK_ORG_ID); the real org is resolved from the email so login works
 * even when the hint is empty or wrong.
 */
export async function verifyTenantCredentials(
  orgHint: string | null,
  identifier: string,
  password: string,
): Promise<TenantSessionUser | null> {
  const email = (identifier ?? "").trim().toLowerCase();
  if (!email || !password) return null;

  const orgId = await resolveTenantOrg(email, orgHint ?? null);
  if (!orgId) return null;

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

/**
 * Provision a credential-backed resident account (admin "add a Lucid user").
 * Returns the tenant_users id. Reuses an existing row for the same email (so
 * re-adding sets a fresh password rather than duplicating the person).
 */
export async function provisionTenantAccount(
  orgId: string,
  opts: { email: string; name?: string; unitId?: string | null; password: string },
): Promise<string> {
  const email = opts.email.trim().toLowerCase();
  const passwordHash = await hashPassword(opts.password);
  return withScope({ orgId, actorType: "system" }, async (tx) => {
    const [existing] = await tx
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.orgId, orgId), eq(sql`lower(${tenantUsers.email})`, email)))
      .limit(1);
    if (existing) {
      await tx
        .update(tenantUsers)
        .set({
          name: opts.name ?? undefined,
          unitId: opts.unitId ?? undefined,
          passwordHash,
          status: "active",
          emailVerifiedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        })
        .where(eq(tenantUsers.id, existing.id));
      return existing.id;
    }
    const [row] = await tx
      .insert(tenantUsers)
      .values({
        orgId,
        email: opts.email,
        name: opts.name ?? null,
        unitId: opts.unitId ?? null,
        status: "active",
        passwordHash,
        emailVerifiedAt: new Date(),
      })
      .returning({ id: tenantUsers.id });
    return row!.id;
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
