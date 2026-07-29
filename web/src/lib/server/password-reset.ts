import "server-only";
import { eq, sql } from "drizzle-orm";
import { users } from "@db/schema/users";
import { tenantUsers } from "@db/schema/compliance";
import { withScope } from "./db";
import { hashPassword, verifyPassword, passwordMeetsPolicy } from "./password";
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens";
import { sendEmail } from "./email";
import { renderNotificationEmail, absoluteUrl } from "./email-templates";
import { recordAuthEvent } from "./auth-events";
import { clientIp } from "./rate-limit";
import { logger } from "./logger";

/**
 * Password reset for staff and tenants (AUTH-005). The token is random, stored
 * **hashed** (sha256), single-use, and expires in 1 hour — the raw token only
 * ever appears in the emailed link, never in the DB, logs, or responses. Request
 * is org-agnostic (the org is resolved from the email / token via the
 * *_system_lookup RLS policies) and **never discloses** whether an account
 * exists. Writes re-scope to the account's real org (staff_org WITH CHECK).
 */

export type Actor = "staff" | "tenant";
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Request a reset link. Always behaves identically whether or not the email
 *  matches an account — the caller shows one generic message. `invite` frames
 *  the email as a first-time account setup rather than a reset. */
export async function requestPasswordReset(
  actor: Actor,
  email: string,
  opts?: { invite?: boolean },
): Promise<void> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return;
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = tokenExpiry(RESET_TTL_MS);

  let recipient: { email: string } | null = null;
  try {
    if (actor === "staff") {
      const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
        tx.select({ id: users.id, orgId: users.orgId, email: users.email })
          .from(users).where(eq(sql`lower(${users.email})`, e)).limit(1),
      );
      const u = found[0];
      if (u) {
        await withScope({ orgId: u.orgId, actorType: "system" }, (tx) =>
          tx.update(users)
            .set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt })
            .where(eq(users.id, u.id)),
        );
        recipient = { email: u.email };
        await recordAuthEvent({ event: opts?.invite ? "invitation_issued" : "reset_requested", orgId: u.orgId, actorType: "user", subjectUserId: u.id, subjectEmail: u.email, ip: await clientIp() });
      }
    } else {
      const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
        tx.select({ id: tenantUsers.id, orgId: tenantUsers.orgId, email: tenantUsers.email })
          .from(tenantUsers).where(eq(sql`lower(${tenantUsers.email})`, e)).limit(1),
      );
      const u = found[0];
      if (u) {
        await withScope({ orgId: u.orgId, actorType: "system" }, (tx) =>
          tx.update(tenantUsers)
            .set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt })
            .where(eq(tenantUsers.id, u.id)),
        );
        recipient = { email: u.email };
        await recordAuthEvent({ event: opts?.invite ? "invitation_issued" : "reset_requested", orgId: u.orgId, actorType: "tenant", subjectTenantUserId: u.id, subjectEmail: u.email, ip: await clientIp() });
      }
    }
  } catch (err) {
    logger.warn("pwreset.request_failed", { actor, err });
    return;
  }

  if (!recipient) {
    // No account — do nothing (and don't reveal it). Same wall-clock either way
    // is not required here since we never return an account-specific signal.
    logger.info("pwreset.request_no_account", { actor });
    return;
  }

  const path = actor === "tenant" ? "/tenant/reset" : "/reset";
  const link = absoluteUrl(`${path}?token=${raw}`);
  const invite = !!opts?.invite;
  const subject = invite ? "Set up your Stack OS account" : "Reset your Stack OS password";
  const { html, text } = renderNotificationEmail({
    heading: invite ? "Welcome to Stack OS" : "Reset your Stack OS password",
    body: invite
      ? "Your Stack OS account is ready. Tap below to choose your password and sign in. This link expires in 1 hour."
      : "We received a request to reset your Stack OS password. This link expires in 1 hour. If you didn't request it, you can safely ignore this email.",
    url: link,
    ctaLabel: invite ? "Choose your password" : "Reset password",
  });
  try {
    await sendEmail({ to: recipient.email, subject, html, text });
    logger.info("pwreset.email_sent", { actor });
  } catch (err) {
    logger.warn("pwreset.email_failed", { actor, err });
  }
}

export interface ResetResult {
  ok: boolean;
  error?: "invalid" | "weak_password" | "invalid_or_expired";
}

/** Complete a reset with the emailed token + a new password. */
export async function completePasswordReset(
  actor: Actor,
  rawToken: string,
  newPassword: string,
): Promise<ResetResult> {
  if (!rawToken || !newPassword) return { ok: false, error: "invalid" };
  if (!passwordMeetsPolicy(newPassword)) return { ok: false, error: "weak_password" };
  const tokenHash = hashToken(rawToken);
  const passwordHash = await hashPassword(newPassword);

  if (actor === "staff") {
    const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
      tx.select({ id: users.id, orgId: users.orgId, exp: users.passwordResetExpiresAt })
        .from(users).where(eq(users.passwordResetTokenHash, tokenHash)).limit(1),
    );
    const row = found[0];
    if (!row || !row.exp || row.exp.getTime() < Date.now()) return { ok: false, error: "invalid_or_expired" };
    await withScope({ orgId: row.orgId, actorType: "system" }, (tx) =>
      tx.update(users)
        .set({
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          status: "active",
          failedLoginCount: 0,
          lockedUntil: null,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
        })
        .where(eq(users.id, row.id)),
    );
    logger.info("pwreset.completed", { actor, usersId: row.id });
    await recordAuthEvent({ event: "reset_completed", orgId: row.orgId, actorType: "user", subjectUserId: row.id, ip: await clientIp() });
    return { ok: true };
  }

  const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
    tx.select({ id: tenantUsers.id, orgId: tenantUsers.orgId, exp: tenantUsers.passwordResetExpiresAt })
      .from(tenantUsers).where(eq(tenantUsers.passwordResetTokenHash, tokenHash)).limit(1),
  );
  const row = found[0];
  if (!row || !row.exp || row.exp.getTime() < Date.now()) return { ok: false, error: "invalid_or_expired" };
  await withScope({ orgId: row.orgId, actorType: "system" }, (tx) =>
    tx.update(tenantUsers)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        status: "active",
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerifiedAt: new Date(),
      })
      .where(eq(tenantUsers.id, row.id)),
  );
  logger.info("pwreset.completed", { actor, tenantUserId: row.id });
  await recordAuthEvent({ event: "reset_completed", orgId: row.orgId, actorType: "tenant", subjectTenantUserId: row.id, ip: await clientIp() });
  return { ok: true };
}

/** Change password while authenticated — verifies the current password first. */
export async function changePassword(
  actor: Actor,
  orgId: string,
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<ResetResult> {
  if (!passwordMeetsPolicy(newPassword)) return { ok: false, error: "weak_password" };

  if (actor === "staff") {
    const ok = await withScope({ orgId, actorType: "system" }, async (tx) => {
      const [u] = await tx.select({ hash: users.passwordHash }).from(users).where(eq(users.id, id)).limit(1);
      if (!u || !(await verifyPassword(currentPassword, u.hash))) return false;
      await tx.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, id));
      return true;
    });
    return ok ? { ok: true } : { ok: false, error: "invalid" };
  }

  const ok = await withScope({ orgId, actorType: "system" }, async (tx) => {
    const [u] = await tx.select({ hash: tenantUsers.passwordHash }).from(tenantUsers).where(eq(tenantUsers.id, id)).limit(1);
    if (!u || !(await verifyPassword(currentPassword, u.hash))) return false;
    await tx.update(tenantUsers).set({ passwordHash: await hashPassword(newPassword) }).where(eq(tenantUsers.id, id));
    return true;
  });
  return ok ? { ok: true } : { ok: false, error: "invalid" };
}
