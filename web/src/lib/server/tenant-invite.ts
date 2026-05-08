import "server-only";
import { z } from "zod";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { tenantUsers } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { withScope, withStaffScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";
import { setTenantSessionCookie, type TenantSession } from "./tenant-auth";
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens";
import { sendEmail } from "./email";

export const inviteTenantUserInput = z.object({
  unitId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
});

export async function inviteTenantUser(input: z.input<typeof inviteTenantUserInput>) {
  const parsed = inviteTenantUserInput.parse(input);
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = tokenExpiry();

  return withStaffScope(async (tx, ctx) => {
    const staffUserId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const u = await tx
      .select({ id: units.id, label: units.label })
      .from(units)
      .where(and(eq(units.orgId, ctx.orgId), eq(units.id, parsed.unitId)))
      .limit(1);
    if (u.length === 0) throw new Error("unit_not_in_org");

    const existing = await tx
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.orgId, ctx.orgId),
          eq(tenantUsers.unitId, parsed.unitId),
          eq(tenantUsers.email, parsed.email),
        ),
      )
      .limit(1);

    let tenantUserId: string;
    if (existing.length > 0) {
      const updated = await tx
        .update(tenantUsers)
        .set({
          name: parsed.name ?? existing[0]!.name,
          phone: parsed.phone ?? existing[0]!.phone,
          magicLinkTokenHash: tokenHash,
          magicLinkExpiresAt: expiresAt,
          status: "invited",
          updatedAt: new Date(),
        })
        .where(eq(tenantUsers.id, existing[0]!.id))
        .returning({ id: tenantUsers.id });
      tenantUserId = updated[0]!.id;
    } else {
      const inserted = await tx
        .insert(tenantUsers)
        .values({
          orgId: ctx.orgId,
          unitId: parsed.unitId,
          email: parsed.email,
          name: parsed.name ?? null,
          phone: parsed.phone ?? null,
          magicLinkTokenHash: tokenHash,
          magicLinkExpiresAt: expiresAt,
          status: "invited",
        })
        .returning({ id: tenantUsers.id });
      tenantUserId = inserted[0]!.id;
    }

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "unit",
      targetId: parsed.unitId,
      action: "tenant_user_invited",
      actorUserId: staffUserId,
      diff: { tenantUserId, email: parsed.email },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/api/tenant/auth/${rawToken}`;

    await sendEmail({
      to: parsed.email,
      subject: `Tenant portal access for unit ${u[0]!.label}`,
      html: `<p>You've been invited to the Stack OS tenant portal for unit ${u[0]!.label}.</p>
<p><a href="${inviteUrl}">Sign in</a> (link expires in 7 days). Use this portal to upload your renter's insurance and view notices about your unit.</p>`,
      text: `Sign in: ${inviteUrl}\n(link expires in 7 days)`,
    });

    return { tenantUserId, inviteUrl };
  });
}

export async function consumeTenantMagicLink(rawToken: string): Promise<TenantSession | null> {
  const tokenHash = hashToken(rawToken);
  const result = await withScope(
    { orgId: "__system__", actorType: "system" },
    async (tx) => findValidToken(tx, tokenHash),
  );
  if (!result) return null;

  await withScope({ orgId: result.orgId, actorType: "system" }, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        magicLinkTokenHash: null,
        magicLinkExpiresAt: null,
        lastSignedInAt: new Date(),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(tenantUsers.id, result.tenantUserId));
    await writeAudit(tx, {
      orgId: result.orgId,
      targetType: "unit",
      targetId: result.unitId ?? result.tenantUserId,
      action: "tenant_user_signed_in",
      actorType: "system",
      diff: { tenantUserId: result.tenantUserId },
    });
  });

  const session: TenantSession = {
    orgId: result.orgId,
    tenantUserId: result.tenantUserId,
  };
  await setTenantSessionCookie(session);
  return session;
}

async function findValidToken(tx: ScopedDB, tokenHash: string) {
  const rows = await tx
    .select({
      id: tenantUsers.id,
      orgId: tenantUsers.orgId,
      unitId: tenantUsers.unitId,
    })
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.magicLinkTokenHash, tokenHash),
        isNotNull(tenantUsers.magicLinkExpiresAt),
        gt(tenantUsers.magicLinkExpiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { tenantUserId: row.id, orgId: row.orgId, unitId: row.unitId };
}
