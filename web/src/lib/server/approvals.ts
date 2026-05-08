import "server-only";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { approvals } from "@db/schema/approvals";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export async function listPendingApprovals() {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.orgId, ctx.orgId), eq(approvals.status, "pending")))
      .orderBy(desc(approvals.createdAt))
      .limit(500),
  );
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
