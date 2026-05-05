import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { attachments } from "@db/schema/attachments";
import { ATTACHMENT_KINDS, POLYMORPHIC_TARGETS } from "@contracts/polymorphic";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const createAttachmentInput = z.object({
  targetType: z.enum(POLYMORPHIC_TARGETS),
  targetId: z.string().uuid(),
  storageKey: z.string().min(1).max(500),
  contentType: z.string().min(1).max(120),
  filename: z.string().max(200).optional(),
  sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
  kind: z.enum(ATTACHMENT_KINDS).default("general"),
});

export async function createAttachment(input: z.infer<typeof createAttachmentInput>) {
  const parsed = createAttachmentInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(attachments)
      .values({
        orgId: ctx.orgId,
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        kind: parsed.kind,
        storageKey: parsed.storageKey,
        contentType: parsed.contentType,
        sizeBytes: parsed.sizeBytes ?? null,
        filename: parsed.filename ?? null,
        uploadedByActorType: "user",
        uploadedByUserId: userId,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      action: "attachment_added",
      actorUserId: userId,
      diff: { attachmentId: row.id, kind: parsed.kind, filename: parsed.filename },
    });
    return row;
  });
}

export async function listAttachments(
  targetType: (typeof POLYMORPHIC_TARGETS)[number],
  targetId: string,
) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.orgId, ctx.orgId),
          eq(attachments.targetType, targetType),
          eq(attachments.targetId, targetId),
        ),
      )
      .orderBy(asc(attachments.kind), asc(attachments.ordering), asc(attachments.createdAt)),
  );
}
