import "server-only";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { approvals } from "@db/schema/approvals";
import { workOrders } from "@db/schema/work-orders";
import { withStaffScope } from "./db";
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
  /** Who's holding the work that this decision blocks. */
  woOwnerName: string | null;
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
      })
      .from(approvals)
      .leftJoin(workOrders, eq(workOrders.id, approvals.targetId))
      .where(
        and(eq(approvals.orgId, ctx.orgId), eq(approvals.status, "pending")),
      )
      .orderBy(desc(approvals.createdAt))
      .limit(500);

    const woIds = rows.map((r) => r.woId).filter((id): id is string => !!id);
    const owners = await loadActiveOwners(tx, ctx.orgId, "work_order", woIds);

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
        woOwnerName: r.woId ? owners.get(r.woId) ?? null : null,
      }),
    );
  });
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
