import "server-only";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { attachments } from "@db/schema/attachments";
import { ATTACHMENT_KINDS, POLYMORPHIC_TARGETS } from "@contracts/polymorphic";
import { withStaffScope } from "./db";
import { signReadUrl, storageConfigured } from "./storage";
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

/**
 * Batch-resolve signed read URLs for a set of attachment ids (e.g. the
 * denormalized `attachment_id` on a list of COI rows). One org-scoped query
 * plus local HMAC signing per row — safe to call from a server component.
 * Returns an empty map when storage is unconfigured.
 */
export async function getAttachmentReadUrls(
  ids: Array<string | null | undefined>,
): Promise<Map<string, { url: string; filename: string | null }>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0 || !storageConfigured()) {
    return new Map();
  }
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: attachments.id,
        storageKey: attachments.storageKey,
        filename: attachments.filename,
      })
      .from(attachments)
      .where(and(eq(attachments.orgId, ctx.orgId), inArray(attachments.id, unique)));
    const out = new Map<string, { url: string; filename: string | null }>();
    for (const r of rows) {
      out.set(r.id, { url: await signReadUrl(r.storageKey), filename: r.filename });
    }
    return out;
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
