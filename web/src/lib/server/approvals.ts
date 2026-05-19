import "server-only";
import { z } from "zod";
import { and, desc, eq, inArray, isNull, sql as drizzleSql } from "drizzle-orm";
import { approvals } from "@db/schema/approvals";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { vendorUsers } from "@db/schema/vendor-users";
import { withStaffScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";
import { loadActiveOwners } from "./owners";

export interface PendingApprovalRow {
  id: string;
  reason: string;
  amountCents: string | null;
  notes: string | null;
  createdAt: Date;
  targetType: string;
  targetId: string;
  /** Originating WO ref, if the approval targets a work order. */
  woRef: string | null;
  /** WO title for the dispatcher's context. */
  woTitle: string | null;
  /** WO status — so the approver sees "blocked / in_progress / new" inline. */
  woStatus: string | null;
  /** WO due date — surfaces "overdue 3d" pressure on the row when the
   *  decision is itself blocking late work. */
  woDueAt: Date | null;
  /** Who's holding the work that this decision blocks. */
  woOwnerName: string | null;
  /** Number of stressed (blocked or overdue) WOs the assigned vendor is
   *  currently carrying. Tier 3: helps the approver see capacity context
   *  before deciding. Null when no vendor is assigned. */
  vendorStressed: number | null;
}

export async function listPendingApprovals(): Promise<PendingApprovalRow[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: approvals.id,
        reason: approvals.reason,
        amountCents: approvals.amountCents,
        notes: approvals.notes,
        createdAt: approvals.createdAt,
        targetType: approvals.targetType,
        targetId: approvals.targetId,
        woId: workOrders.id,
        woNumber: workOrders.number,
        woTitle: workOrders.title,
        woStatus: workOrders.status,
        woDueAt: workOrders.dueAt,
      })
      .from(approvals)
      .leftJoin(workOrders, eq(workOrders.id, approvals.targetId))
      .where(
        and(eq(approvals.orgId, ctx.orgId), eq(approvals.status, "pending")),
      )
      .orderBy(desc(approvals.createdAt))
      .limit(500);

    const woIds = rows.map((r) => r.woId).filter((id): id is string => !!id);
    const [owners, vendorStress] = await Promise.all([
      loadActiveOwners(tx, ctx.orgId, "work_order", woIds),
      loadVendorStressForWos(tx, ctx.orgId, woIds),
    ]);

    return rows.map(
      (r): PendingApprovalRow => ({
        id: r.id,
        reason: r.reason,
        amountCents: r.amountCents,
        notes: r.notes,
        createdAt: r.createdAt,
        targetType: r.targetType,
        targetId: r.targetId,
        woRef: r.woNumber ? `WO-${r.woNumber}` : null,
        woTitle: r.woTitle,
        woStatus: r.woStatus,
        woDueAt: r.woDueAt,
        woOwnerName: r.woId ? owners.get(r.woId) ?? null : null,
        vendorStressed: r.woId ? vendorStress.get(r.woId) ?? null : null,
      }),
    );
  });
}

/**
 * For each work-order id, return the count of stressed (blocked or
 * overdue) WOs the assigned vendor is currently carrying. Two queries:
 * first map WO → vendor; second map vendor → stressed count. Joins
 * are cheap because both queries are scoped by the focal WO list.
 */
async function loadVendorStressForWos(
  tx: ScopedDB,
  orgId: string,
  woIds: string[],
): Promise<Map<string, number>> {
  if (woIds.length === 0) return new Map();
  // The WO may be assigned either directly to a vendor or via a
  // vendor_user (a specific person at the vendor). Both should
  // resolve to the same vendor id for stress purposes.
  const vendorByWo = await tx
    .select({
      targetId: assignments.targetId,
      vendorId: drizzleSql<string>`CASE WHEN ${assignments.assigneeType} = 'vendor' THEN ${assignments.assigneeId} ELSE ${vendorUsers.vendorId} END`,
    })
    .from(assignments)
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        drizzleSql`${assignments.assigneeType} IN ('vendor', 'vendor_user')`,
        inArray(assignments.targetId, woIds),
        isNull(assignments.unassignedAt),
      ),
    );
  if (vendorByWo.length === 0) return new Map();
  const uniqueVendors = Array.from(
    new Set(vendorByWo.map((r) => r.vendorId)),
  );
  const now = new Date();
  const stressedRows = await tx
    .select({
      vendorId: assignments.assigneeId,
      n: drizzleSql<string>`count(distinct ${workOrders.id})::text`,
    })
    .from(assignments)
    .innerJoin(workOrders, eq(workOrders.id, assignments.targetId))
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        eq(assignments.assigneeType, "vendor"),
        inArray(assignments.assigneeId, uniqueVendors),
        isNull(assignments.unassignedAt),
        drizzleSql`(${workOrders.status} = 'blocked' OR (${workOrders.dueAt} < ${now} AND ${workOrders.status} NOT IN ('closed', 'cancelled', 'resolved', 'verified')))`,
      ),
    )
    .groupBy(assignments.assigneeId);
  const stressedByVendor = new Map<string, number>();
  for (const r of stressedRows) {
    stressedByVendor.set(r.vendorId, Number(r.n));
  }
  const out = new Map<string, number>();
  for (const r of vendorByWo) {
    out.set(r.targetId, stressedByVendor.get(r.vendorId) ?? 0);
  }
  return out;
}

export const decideApprovalInput = z.object({
  id: z.string().uuid(),
  to: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional(),
});

export async function decideApproval(input: z.input<typeof decideApprovalInput>) {
  const parsed = decideApprovalInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const cur = await tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.orgId, ctx.orgId), eq(approvals.id, parsed.id)))
      .limit(1);
    const a = cur[0];
    if (!a) throw new Error("approval_not_found");
    if (a.status !== "pending") throw new Error("approval_already_decided");

    const updated = await tx
      .update(approvals)
      .set({
        status: parsed.to,
        decidedByUserId: userId,
        decidedAt: new Date(),
        notes: parsed.notes ?? a.notes,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, parsed.id))
      .returning();

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: a.targetType,
      targetId: a.targetId,
      action: "approval_decided",
      actorUserId: userId,
      diff: { approvalId: a.id, to: parsed.to, reason: a.reason },
    });

    return updated[0]!;
  });
}
