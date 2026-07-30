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

/**
 * Find the account behind an email in **either** table.
 *
 * Staff live in `users`, residents in `tenant_users`, and each has its own
 * reset page (`/forgot` vs `/tenant/forgot`). Filtering by the page the person
 * happened to open meant a tech who opened the resident page — or a resident
 * who opened the ops page — got "a reset link is on its way" and no email, with
 * nothing recorded anywhere. So `preferred` is only a tie-breaker for someone
 * who exists in both tables; otherwise we use whichever table has them.
 *
 * Ordering is explicit because neither table guarantees one row per email:
 * `users` is unique per (org, email) and `tenant_users` per (org, unit, email),
 * so the same address can appear in several orgs/units. Prefer a row that can
 * actually sign in (active, password set), then the oldest — otherwise the
 * lookup here and the one at login can silently pick different rows, and a
 * "successful" reset lands on an account the person never signs into.
 */
async function findAccount(
  email: string,
  preferred: Actor,
): Promise<
  | { actor: "staff"; id: string; orgId: string; email: string }
  | { actor: "tenant"; id: string; orgId: string; email: string }
  | null
> {
  const staff = async () => {
    const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
      tx
        .select({ id: users.id, orgId: users.orgId, email: users.email })
        .from(users)
        .where(eq(sql`lower(${users.email})`, email))
        .orderBy(
          sql`(${users.status} = 'active') desc`,
          sql`(${users.passwordHash} is not null) desc`,
          users.createdAt,
        )
        .limit(1),
    );
    const u = found[0];
    return u ? ({ actor: "staff", ...u } as const) : null;
  };

  const tenant = async () => {
    const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
      tx
        .select({ id: tenantUsers.id, orgId: tenantUsers.orgId, email: tenantUsers.email })
        .from(tenantUsers)
        .where(eq(sql`lower(${tenantUsers.email})`, email))
        .orderBy(
          sql`(${tenantUsers.status} <> 'revoked') desc`,
          sql`(${tenantUsers.passwordHash} is not null) desc`,
          tenantUsers.createdAt,
        )
        .limit(1),
    );
    const u = found[0];
    return u ? ({ actor: "tenant", ...u } as const) : null;
  };

  const [first, second] = preferred === "staff" ? [staff, tenant] : [tenant, staff];
  return (await first()) ?? (await second());
}

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

  let recipient: { email: string; actor: Actor } | null = null;
  try {
    const account = await findAccount(e, actor);
    if (account?.actor === "staff") {
      await withScope({ orgId: account.orgId, actorType: "system" }, (tx) =>
        tx.update(users)
          .set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt })
          .where(eq(users.id, account.id)),
      );
      recipient = { email: account.email, actor: "staff" };
      await recordAuthEvent({ event: opts?.invite ? "invitation_issued" : "reset_requested", orgId: account.orgId, actorType: "user", subjectUserId: account.id, subjectEmail: account.email, ip: await clientIp(), meta: { requested_via: actor } });
    } else if (account?.actor === "tenant") {
      await withScope({ orgId: account.orgId, actorType: "system" }, (tx) =>
        tx.update(tenantUsers)
          .set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt })
          .where(eq(tenantUsers.id, account.id)),
      );
      recipient = { email: account.email, actor: "tenant" };
      await recordAuthEvent({ event: opts?.invite ? "invitation_issued" : "reset_requested", orgId: account.orgId, actorType: "tenant", subjectTenantUserId: account.id, subjectEmail: account.email, ip: await clientIp(), meta: { requested_via: actor } });
    }
  } catch (err) {
    logger.warn("pwreset.request_failed", { actor, err });
    return;
  }

  if (!recipient) {
    // No account in either table — say nothing to the caller (no enumeration),
    // but leave an audit trail. This is the only record that the attempt ever
    // happened, and it is what turns "the reset is broken" into a five-second
    // answer: the address typed simply has no account.
    logger.info("pwreset.request_no_account", { actor });
    await recordAuthEvent({ event: "reset_no_match", actorType: "system", subjectEmail: e, ip: await clientIp(), meta: { requested_via: actor } });
    return;
  }

  const path = recipient.actor === "tenant" ? "/tenant/reset" : "/reset";
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
    logger.info("pwreset.email_sent", { actor: recipient.actor });
  } catch (err) {
    // The token is already stored, so the account is now in a state where the
    // person is waiting on an email that will never arrive. Audit it — a
    // provider outage otherwise looks identical to "the link went to spam".
    logger.warn("pwreset.email_failed", { actor: recipient.actor, err });
    await recordAuthEvent({ event: "reset_email_failed", actorType: "system", subjectEmail: recipient.email, ip: await clientIp(), meta: { reason: err instanceof Error ? err.message : "unknown" } });
  }
}

export interface ResetResult {
  ok: boolean;
  error?: "invalid" | "weak_password" | "invalid_or_expired";
  /** Which account the token actually belonged to — the caller uses this to
   *  send the person to the matching sign-in page. */
  actor?: Actor;
}

/**
 * Complete a reset with the emailed token + a new password.
 *
 * `actor` is the page the link landed on, and is only a preference: the token
 * is a 32-byte secret, so looking for it in the other table too leaks nothing
 * and means a link opened on the wrong surface still works instead of reading
 * as "invalid or expired".
 */
export async function completePasswordReset(
  actor: Actor,
  rawToken: string,
  newPassword: string,
): Promise<ResetResult> {
  if (!rawToken || !newPassword) return { ok: false, error: "invalid" };
  if (!passwordMeetsPolicy(newPassword)) return { ok: false, error: "weak_password" };
  const tokenHash = hashToken(rawToken);
  const passwordHash = await hashPassword(newPassword);

  const staffRow = async () => {
    const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
      tx.select({ id: users.id, orgId: users.orgId, exp: users.passwordResetExpiresAt })
        .from(users).where(eq(users.passwordResetTokenHash, tokenHash)).limit(1),
    );
    return found[0] ?? null;
  };
  const tenantRow = async () => {
    const found = await withScope({ orgId: "_", actorType: "system" }, (tx) =>
      tx.select({ id: tenantUsers.id, orgId: tenantUsers.orgId, exp: tenantUsers.passwordResetExpiresAt })
        .from(tenantUsers).where(eq(tenantUsers.passwordResetTokenHash, tokenHash)).limit(1),
    );
    return found[0] ?? null;
  };

  // Look in the surface's own table first, then the other one.
  let staff = actor === "staff" ? await staffRow() : null;
  let tenant = actor === "tenant" ? await tenantRow() : null;
  if (!staff && !tenant) {
    if (actor === "staff") tenant = await tenantRow();
    else staff = await staffRow();
  }
  if (!staff && !tenant) return { ok: false, error: "invalid_or_expired" };

  if (staff) {
    const row = staff;
    if (!row.exp || row.exp.getTime() < Date.now()) return { ok: false, error: "invalid_or_expired" };
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
    logger.info("pwreset.completed", { actor: "staff", usersId: row.id });
    await recordAuthEvent({ event: "reset_completed", orgId: row.orgId, actorType: "user", subjectUserId: row.id, ip: await clientIp(), meta: { opened_via: actor } });
    return { ok: true, actor: "staff" };
  }

  const row = tenant!;
  if (!row.exp || row.exp.getTime() < Date.now()) return { ok: false, error: "invalid_or_expired" };
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
        mustChangePassword: false,
      })
      .where(eq(tenantUsers.id, row.id)),
  );
  logger.info("pwreset.completed", { actor: "tenant", tenantUserId: row.id });
  await recordAuthEvent({ event: "reset_completed", orgId: row.orgId, actorType: "tenant", subjectTenantUserId: row.id, ip: await clientIp(), meta: { opened_via: actor } });
  return { ok: true, actor: "tenant" };
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
