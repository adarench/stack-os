import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { vendorCois } from "@db/schema/compliance";
import { vendors } from "@db/schema/vendors";
import { attachments } from "@db/schema/attachments";
import {
  COMPLIANCE_STATUSES,
  computeComplianceStatus,
  type ComplianceStatus,
} from "@contracts/compliance";
import { withScope, withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const recordCoiInput = z.object({
  vendorId: z.string().uuid(),
  policyNumber: z.string().max(120).optional(),
  carrier: z.string().max(120).optional(),
  coverageAmountCents: z.number().int().min(0).optional(),
  effectiveAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  attachmentId: z.string().uuid().optional(),
  // A freshly-uploaded document (already stored via the sign route). Recorded
  // as a polymorphic attachment against the new COI row, and denormalized onto
  // vendor_cois.attachment_id — all in the same transaction.
  upload: z
    .object({
      storageKey: z.string().min(1).max(500),
      contentType: z.string().min(1).max(120),
      filename: z.string().max(200).optional(),
      sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
    })
    .optional(),
  notes: z.string().max(10_000).optional(),
});

export async function recordCoi(input: z.input<typeof recordCoiInput>) {
  const parsed = recordCoiInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    // Confirm vendor in org.
    const v = await tx
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.orgId, ctx.orgId), eq(vendors.id, parsed.vendorId)))
      .limit(1);
    if (v.length === 0) throw new Error("vendor_not_in_org");

    const status = computeComplianceStatus({
      effectiveAt: parsed.effectiveAt ?? null,
      expiresAt: parsed.expiresAt ?? null,
    });

    // Mark prior active COIs as superseded.
    await tx
      .update(vendorCois)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(vendorCois.orgId, ctx.orgId),
          eq(vendorCois.vendorId, parsed.vendorId),
          eq(vendorCois.status, "active"),
        ),
      );

    const inserted = await tx
      .insert(vendorCois)
      .values({
        orgId: ctx.orgId,
        vendorId: parsed.vendorId,
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
      targetType: "vendor_coi",
      targetId: row.id,
      action: "recorded",
      actorUserId: userId,
      diff: {
        vendorId: parsed.vendorId,
        expiresAt: parsed.expiresAt?.toISOString(),
        status,
      },
    });

    // Persist the uploaded document as a polymorphic attachment and link it
    // back onto the COI row. The COI id doesn't exist until the insert above,
    // so the attach happens here (same tx) rather than before recording.
    if (parsed.upload) {
      const att = await tx
        .insert(attachments)
        .values({
          orgId: ctx.orgId,
          targetType: "vendor_coi",
          targetId: row.id,
          kind: "coi",
          storageKey: parsed.upload.storageKey,
          contentType: parsed.upload.contentType,
          sizeBytes: parsed.upload.sizeBytes ?? null,
          filename: parsed.upload.filename ?? null,
          uploadedByActorType: "user",
          uploadedByUserId: userId,
        })
        .returning({ id: attachments.id });
      const attachmentId = att[0]!.id;
      await tx
        .update(vendorCois)
        .set({ attachmentId, updatedAt: new Date() })
        .where(eq(vendorCois.id, row.id));
      row.attachmentId = attachmentId;
      await writeAudit(tx, {
        orgId: ctx.orgId,
        targetType: "vendor_coi",
        targetId: row.id,
        action: "attachment_added",
        actorUserId: userId,
        diff: { attachmentId, kind: "coi", filename: parsed.upload.filename },
      });
    }

    return row;
  });
}

export async function listCois(filter?: { vendorId?: string; status?: ComplianceStatus }) {
  return withStaffScope(async (tx, ctx) => {
    const conds = [eq(vendorCois.orgId, ctx.orgId)];
    if (filter?.vendorId) conds.push(eq(vendorCois.vendorId, filter.vendorId));
    if (filter?.status) conds.push(eq(vendorCois.status, filter.status));
    return tx
      .select()
      .from(vendorCois)
      .where(and(...conds))
      .orderBy(desc(vendorCois.createdAt))
      .limit(500);
  });
}

/**
 * Returns true iff the vendor has at least one COI in `active` or
 * `expiring` status (i.e. not yet expired). Caller should treat false
 * as a gate against new assignments unless an override is set.
 */
export async function vendorHasActiveCoi(vendorId: string): Promise<boolean> {
  return withStaffScope(async (tx, ctx) => {
    const r = await tx
      .select({ id: vendorCois.id })
      .from(vendorCois)
      .where(
        and(
          eq(vendorCois.orgId, ctx.orgId),
          eq(vendorCois.vendorId, vendorId),
          eq(vendorCois.status, "active"),
        ),
      )
      .limit(1);
    if (r.length > 0) return true;
    const exp = await tx
      .select({ id: vendorCois.id })
      .from(vendorCois)
      .where(
        and(
          eq(vendorCois.orgId, ctx.orgId),
          eq(vendorCois.vendorId, vendorId),
          eq(vendorCois.status, "expiring"),
        ),
      )
      .limit(1);
    return exp.length > 0;
  });
}

/**
 * Inngest sweep: reads all COIs that should have transitioned status,
 * groups by org, and updates each. Idempotent — running twice in a row
 * makes no further changes.
 */
export async function runCoiExpirySweep(now: Date = new Date()): Promise<{
  scanned: number;
  toExpiring: number;
  toExpired: number;
}> {
  // Cross-org scan under system actor (vendor_cois_system_scan policy).
  const all = await withScope(
    { orgId: "__cron_scan__", actorType: "system" },
    async (tx) =>
      tx
        .select({
          id: vendorCois.id,
          orgId: vendorCois.orgId,
          status: vendorCois.status,
          expiresAt: vendorCois.expiresAt,
        })
        .from(vendorCois)
        .where(lte(vendorCois.status, "expiring" as ComplianceStatus)), // 'active' or 'expiring' (string ordering by enum value isn't ideal; we filter in JS instead)
  ).catch(() => [] as Array<{ id: string; orgId: string; status: ComplianceStatus; expiresAt: Date | null }>);

  let toExpiring = 0;
  let toExpired = 0;
  // Group by org, then update per-org.
  const byOrg = new Map<string, Array<{ id: string; current: ComplianceStatus; next: ComplianceStatus }>>();

  for (const c of all) {
    if (c.status !== "active" && c.status !== "expiring") continue; // skip terminal states
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
          .update(vendorCois)
          .set({ status: t.next, updatedAt: new Date() })
          .where(eq(vendorCois.id, t.id));
        await writeAudit(tx, {
          orgId,
          targetType: "vendor_coi",
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
