import "server-only";
import { z } from "zod";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { vendorUsers } from "@db/schema/vendor-users";
import { vendors } from "@db/schema/vendors";
import { withStaffScope, withScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";
import { setVendorSessionCookie, type VendorSession } from "./vendor-auth";
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens";
import { sendEmail } from "./email";

export const inviteVendorUserInput = z.object({
  vendorId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
});

/**
 * Staff invites a vendor user. Creates (or refreshes) a `vendor_users` row,
 * issues a fresh magic-link token, and emails it.
 *
 * Returns the inviteUrl for ops/testing. In production the URL is only sent
 * via the email channel.
 */
export async function inviteVendorUser(input: z.infer<typeof inviteVendorUserInput>) {
  const parsed = inviteVendorUserInput.parse(input);
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = tokenExpiry();

  return withStaffScope(async (tx, ctx) => {
    const staffUserId = await ensureUserRow(tx, ctx.orgId, ctx.userId);

    // Confirm the vendor belongs to this org.
    const v = await tx
      .select({ id: vendors.id, name: vendors.name })
      .from(vendors)
      .where(and(eq(vendors.orgId, ctx.orgId), eq(vendors.id, parsed.vendorId)))
      .limit(1);
    if (v.length === 0) throw new Error("vendor_not_in_org");

    // Upsert the vendor_user by (org, vendor, email).
    const existing = await tx
      .select()
      .from(vendorUsers)
      .where(
        and(
          eq(vendorUsers.orgId, ctx.orgId),
          eq(vendorUsers.vendorId, parsed.vendorId),
          eq(vendorUsers.email, parsed.email),
        ),
      )
      .limit(1);

    let vendorUserId: string;
    if (existing.length > 0) {
      const updated = await tx
        .update(vendorUsers)
        .set({
          name: parsed.name ?? existing[0]!.name,
          phone: parsed.phone ?? existing[0]!.phone,
          magicLinkTokenHash: tokenHash,
          magicLinkExpiresAt: expiresAt,
          status: "invited",
          updatedAt: new Date(),
        })
        .where(eq(vendorUsers.id, existing[0]!.id))
        .returning({ id: vendorUsers.id });
      vendorUserId = updated[0]!.id;
    } else {
      const inserted = await tx
        .insert(vendorUsers)
        .values({
          orgId: ctx.orgId,
          vendorId: parsed.vendorId,
          email: parsed.email,
          name: parsed.name ?? null,
          phone: parsed.phone ?? null,
          magicLinkTokenHash: tokenHash,
          magicLinkExpiresAt: expiresAt,
          status: "invited",
        })
        .returning({ id: vendorUsers.id });
      vendorUserId = inserted[0]!.id;
    }

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "vendor",
      targetId: parsed.vendorId,
      action: "vendor_user_invited",
      actorUserId: staffUserId,
      diff: { vendorUserId, email: parsed.email },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/api/vendor/auth/${rawToken}`;

    await sendEmail({
      to: parsed.email,
      subject: `You've been invited to ${v[0]!.name} on Stack OS`,
      html: `<p>You've been invited to access work orders on Stack OS.</p>
<p><a href="${inviteUrl}">Sign in</a> (link expires in 7 days).</p>`,
      text: `Sign in: ${inviteUrl}\n(link expires in 7 days)`,
    });

    return { vendorUserId, inviteUrl };
  });
}

/**
 * Verify a raw token and start a vendor session (cookie set).
 * Called by /api/vendor/auth/[token] route.
 *
 * Uses {@link withScope} with `system` actor since the vendor isn't yet
 * authenticated (no session var to set).
 */
export async function consumeMagicLinkAndStartSession(rawToken: string): Promise<VendorSession | null> {
  const tokenHash = hashToken(rawToken);

  // Need to look up *across orgs* — vendor's email could belong to multiple
  // PMs. We use a system-scoped tx (BYPASSRLS in production; in dev we set
  // app.org_id later once we know it).
  // For now: do a direct query without RLS by using a "system" actor scope
  // with a sentinel org_id. This requires the `staff_org` policy to allow
  // 'system' actor type — which it does.
  //
  // Trade-off: in dev without BYPASSRLS, RLS still applies. We work around
  // by setting actor_type='system' and org_id to '*'. The staff policy will
  // reject because '*' doesn't match any row's org_id, so this lookup needs
  // BYPASSRLS in production.
  //
  // For P1 until BYPASSRLS role exists, we accept this is a stub: the token
  // verification path is deferred to ARCHITECTURE day 1 + DB superuser.

  const result = await withScope({ orgId: "__system__", actorType: "system" }, async (tx) => {
    return findValidToken(tx, tokenHash);
  });
  if (!result) return null;

  const { vendorUserId, vendorId, orgId } = result;

  // Mark used: scoped to this vendor_user's org.
  await withScope({ orgId, actorType: "system" }, async (tx) => {
    await tx
      .update(vendorUsers)
      .set({
        magicLinkTokenHash: null,
        magicLinkExpiresAt: null,
        lastSignedInAt: new Date(),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(vendorUsers.id, vendorUserId));
    await writeAudit(tx, {
      orgId,
      targetType: "vendor",
      targetId: vendorId,
      action: "vendor_user_signed_in",
      actorType: "system",
      diff: { vendorUserId },
    });
  });

  const session: VendorSession = { orgId, vendorUserId, vendorId };
  await setVendorSessionCookie(session);
  return session;
}

async function findValidToken(tx: ScopedDB, tokenHash: string) {
  const rows = await tx
    .select({
      id: vendorUsers.id,
      vendorId: vendorUsers.vendorId,
      orgId: vendorUsers.orgId,
    })
    .from(vendorUsers)
    .where(
      and(
        eq(vendorUsers.magicLinkTokenHash, tokenHash),
        isNotNull(vendorUsers.magicLinkExpiresAt),
        gt(vendorUsers.magicLinkExpiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { vendorUserId: row.id, vendorId: row.vendorId, orgId: row.orgId };
}
