import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { comments } from "@db/schema/comments";
import { workOrders } from "@db/schema/work-orders";
import { tenantUsers } from "@db/schema/compliance";
import { POLYMORPHIC_TARGETS } from "@contracts/polymorphic";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";
import { emitNotification } from "./notifications";

export const createCommentInput = z.object({
  targetType: z.enum(POLYMORPHIC_TARGETS),
  targetId: z.string().uuid(),
  body: z.string().min(1).max(10_000),
  visibility: z.enum(["internal", "external"]).default("internal"),
});

export async function createComment(input: z.infer<typeof createCommentInput>) {
  const parsed = createCommentInput.parse(input);
  const result = await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(comments)
      .values({
        orgId: ctx.orgId,
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        body: parsed.body,
        actorType: "user",
        actorUserId: userId,
        visibility: parsed.visibility,
      })
      .returning();
    const row = inserted[0]!;

    // An external note on a work order is a tenant-visible update — stamp the
    // WO so /work can show "tenant updated Xh ago" vs "tenant not updated",
    // and (if the WO was tenant-reported) notify the resident.
    let notify: { tenantId: string; phone: string | null; email: string | null; number: number; title: string } | null = null;
    if (parsed.targetType === "work_order" && parsed.visibility === "external") {
      await tx
        .update(workOrders)
        .set({ tenantUpdatedAt: new Date() })
        .where(
          and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.id, parsed.targetId)),
        );
      const [wo] = await tx
        .select({
          number: workOrders.number,
          title: workOrders.title,
          tenantUserId: workOrders.createdByTenantUserId,
        })
        .from(workOrders)
        .where(eq(workOrders.id, parsed.targetId))
        .limit(1);
      if (wo?.tenantUserId) {
        const [t] = await tx
          .select({ id: tenantUsers.id, phone: tenantUsers.phone, email: tenantUsers.email })
          .from(tenantUsers)
          .where(and(eq(tenantUsers.orgId, ctx.orgId), eq(tenantUsers.id, wo.tenantUserId)))
          .limit(1);
        if (t) notify = { tenantId: t.id, phone: t.phone, email: t.email, number: wo.number, title: wo.title };
      }
    }

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      action: "comment_added",
      actorUserId: userId,
      diff: { commentId: row.id, visibility: parsed.visibility },
    });
    return { row, notify, orgId: ctx.orgId };
  });

  if (result.notify) {
    await emitNotification({
      orgId: result.orgId,
      recipientTenantUserId: result.notify.tenantId,
      recipientEmail: result.notify.email,
      recipientPhone: result.notify.phone,
      kind: "wo_message",
      subject: "New message about your request",
      body: `The team replied on “${result.notify.title}”.`,
      targetType: "work_order",
      targetId: parsed.targetId,
      url: `/tenant/WO-${result.notify.number}`,
      actor: { type: "user" },
    });
  }
  return result.row;
}

export async function listComments(targetType: (typeof POLYMORPHIC_TARGETS)[number], targetId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.orgId, ctx.orgId),
          eq(comments.targetType, targetType),
          eq(comments.targetId, targetId),
        ),
      )
      .orderBy(asc(comments.createdAt)),
  );
}
