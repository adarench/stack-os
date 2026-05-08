import "server-only";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { tenantInsurancePolicies, tenantUsers } from "@db/schema/compliance";
import {
  COMPLIANCE_STATUSES,
  computeComplianceStatus,
  type ComplianceStatus,
} from "@contracts/compliance";
import { withScope, withStaffScope, withTenantScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const recordTenantInsuranceInput = z.object({
  tenantUserId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  policyNumber: z.string().max(120).optional(),
  carrier: z.string().max(120).optional(),
  coverageAmountCents: z.number().int().min(0).optional(),
  effectiveAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  attachmentId: z.string().uuid().optional(),
  notes: z.string().max(10_000).optional(),
});

/**
 * Staff-side record (admin entered). For tenant self-upload from the
 * tenant portal use {@link recordTenantInsuranceFromPortal}.
 */
export async function recordTenantInsurance(
  input: z.input<typeof recordTenantInsuranceInput>,
) {
  const parsed = recordTenantInsuranceInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const status = computeComplianceStatus({
      effectiveAt: parsed.effectiveAt ?? null,
      expiresAt: parsed.expiresAt ?? null,
    });
    // Mark prior active as superseded.
    await tx
      .update(tenantInsurancePolicies)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(tenantInsurancePolicies.orgId, ctx.orgId),
          eq(tenantInsurancePolicies.tenantUserId, parsed.tenantUserId),
          eq(tenantInsurancePolicies.status, "active"),
        ),
      );
    const inserted = await tx
      .insert(tenantInsurancePolicies)
      .values({
        orgId: ctx.orgId,
        tenantUserId: parsed.tenantUserId,
        unitId: parsed.unitId ?? null,
        policyNumber: parsed.policyNumber ?? null,
        carrier: parsed.carrier ?? null,
        coverageAmountCents:
          parsed.coverageAmountCents != null ? String(parsed.coverageAmountCents) : null,
        effectiveAt: parsed.effectiveAt ?? null,
        expiresAt: parsed.expiresAt ?? null,
        attachmentId: parsed.attachmentId ?? null,
        status,
        notes: parsed.notes ?? null,
        uploadedByActorType: "user",
        uploadedByUserId: userId,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "tenant_insurance_policy",
      targetId: row.id,
      action: "recorded",
      actorUserId: userId,
      diff: { tenantUserId: parsed.tenantUserId, status },
    });
    return row;
  });
}

export async function recordTenantInsuranceFromPortal(
  ctx: { orgId: string; tenantUserId: string },
  input: Omit<z.input<typeof recordTenantInsuranceInput>, "tenantUserId">,
) {
  const status = computeComplianceStatus({
    effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
  return withTenantScope(ctx, async (tx) => {
    await tx
      .update(tenantInsurancePolicies)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(tenantInsurancePolicies.orgId, ctx.orgId),
          eq(tenantInsurancePolicies.tenantUserId, ctx.tenantUserId),
          eq(tenantInsurancePolicies.status, "active"),
        ),
      );
    const inserted = await tx
      .insert(tenantInsurancePolicies)
      .values({
        orgId: ctx.orgId,
        tenantUserId: ctx.tenantUserId,
        unitId: input.unitId ?? null,
        policyNumber: input.policyNumber ?? null,
        carrier: input.carrier ?? null,
        coverageAmountCents:
          input.coverageAmountCents != null ? String(input.coverageAmountCents) : null,
        effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        attachmentId: input.attachmentId ?? null,
        status,
        notes: input.notes ?? null,
        uploadedByActorType: "tenant",
        uploadedByTenantUserId: ctx.tenantUserId,
      })
      .returning();
    return inserted[0]!;
  });
}

export async function listTenantInsurance(filter?: { status?: ComplianceStatus }) {
  return withStaffScope(async (tx, ctx) => {
    const conds = [eq(tenantInsurancePolicies.orgId, ctx.orgId)];
    if (filter?.status) conds.push(eq(tenantInsurancePolicies.status, filter.status));
    return tx
      .select({
        policy: tenantInsurancePolicies,
        tenantEmail: tenantUsers.email,
        tenantName: tenantUsers.name,
      })
      .from(tenantInsurancePolicies)
      .leftJoin(tenantUsers, eq(tenantUsers.id, tenantInsurancePolicies.tenantUserId))
      .where(and(...conds))
      .orderBy(desc(tenantInsurancePolicies.createdAt))
      .limit(500);
  });
}

/**
 * Inngest sweep — same pattern as runCoiExpirySweep.
 */
export async function runTenantInsuranceExpirySweep(
  now: Date = new Date(),
): Promise<{ scanned: number; toExpiring: number; toExpired: number }> {
  const all = await withScope(
    { orgId: "__cron_scan__", actorType: "system" },
    async (tx) =>
      tx
        .select({
          id: tenantInsurancePolicies.id,
          orgId: tenantInsurancePolicies.orgId,
          status: tenantInsurancePolicies.status,
          expiresAt: tenantInsurancePolicies.expiresAt,
        })
        .from(tenantInsurancePolicies),
  ).catch(() => [] as Array<{ id: string; orgId: string; status: ComplianceStatus; expiresAt: Date | null }>);

  let toExpiring = 0;
  let toExpired = 0;
  const byOrg = new Map<string, Array<{ id: string; current: ComplianceStatus; next: ComplianceStatus }>>();

  for (const c of all) {
    if (c.status !== "active" && c.status !== "expiring") continue;
    const next = computeComplianceStatus({
      effectiveAt: null,
      expiresAt: c.expiresAt,
      now,
    });
    if (next === c.status) continue;
    const arr = byOrg.get(c.orgId) ?? [];
    arr.push({ id: c.id, current: c.status as ComplianceStatus, next });
    byOrg.set(c.orgId, arr);
  }

  for (const [orgId, transitions] of byOrg) {
    await withScope({ orgId, actorType: "system" }, async (tx) => {
      for (const t of transitions) {
        await tx
          .update(tenantInsurancePolicies)
          .set({ status: t.next, updatedAt: new Date() })
          .where(eq(tenantInsurancePolicies.id, t.id));
        await writeAudit(tx, {
          orgId,
          targetType: "tenant_insurance_policy",
          targetId: t.id,
          action: "status_changed",
          actorType: "system",
          diff: { from: t.current, to: t.next },
        });
        if (t.next === "expiring") toExpiring += 1;
        if (t.next === "expired") toExpired += 1;
      }
    });
  }

  return { scanned: all.length, toExpiring, toExpired };
}

export { COMPLIANCE_STATUSES };
