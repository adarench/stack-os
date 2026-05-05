import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { comments } from "@db/schema/comments";
import { POLYMORPHIC_TARGETS } from "@contracts/polymorphic";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const createCommentInput = z.object({
  targetType: z.enum(POLYMORPHIC_TARGETS),
  targetId: z.string().uuid(),
  body: z.string().min(1).max(10_000),
  visibility: z.enum(["internal", "external"]).default("internal"),
});

export async function createComment(input: z.infer<typeof createCommentInput>) {
  const parsed = createCommentInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
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
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      action: "comment_added",
      actorUserId: userId,
      diff: { commentId: row.id, visibility: parsed.visibility },
    });
    return row;
  });
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
