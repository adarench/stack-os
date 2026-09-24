import "server-only";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { comments } from "@db/schema/comments";
import { users } from "@db/schema/users";
import { vendorUsers } from "@db/schema/vendor-users";
import { tenantUsers } from "@db/schema/compliance";
import { POLYMORPHIC_TARGETS } from "@contracts/polymorphic";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";
import {
  commentAuthorLabel,
  formatTenantNames,
  type NamedPerson,
} from "@/lib/messaging-labels";

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

export async function listComments(
  targetType: (typeof POLYMORPHIC_TARGETS)[number],
  targetId: string,
) {
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

export type CommentWithAuthor = Awaited<ReturnType<typeof listComments>>[number] & {
  authorLabel: string;
};

/** Comments plus resolved author display labels (ops #21). */
export async function listCommentsWithAuthors(
  targetType: (typeof POLYMORPHIC_TARGETS)[number],
  targetId: string,
): Promise<CommentWithAuthor[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.orgId, ctx.orgId),
          eq(comments.targetType, targetType),
          eq(comments.targetId, targetId),
        ),
      )
      .orderBy(asc(comments.createdAt));

    const staffIds = [
      ...new Set(
        rows
          .filter((r) => r.actorType === "user" && r.actorUserId)
          .map((r) => r.actorUserId as string),
      ),
    ];
    const vendorIds = [
      ...new Set(
        rows
          .filter((r) => r.actorType === "vendor" && r.actorUserId)
          .map((r) => r.actorUserId as string),
      ),
    ];

    const staffById = new Map<string, NamedPerson>();
    if (staffIds.length > 0) {
      const staffRows = await tx
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.orgId, ctx.orgId), inArray(users.id, staffIds)));
      for (const s of staffRows) staffById.set(s.id, s);
    }

    const vendorById = new Map<string, NamedPerson>();
    if (vendorIds.length > 0) {
      const vendorRows = await tx
        .select({
          id: vendorUsers.id,
          name: vendorUsers.name,
          email: vendorUsers.email,
        })
        .from(vendorUsers)
        .where(
          and(eq(vendorUsers.orgId, ctx.orgId), inArray(vendorUsers.id, vendorIds)),
        );
      for (const v of vendorRows) vendorById.set(v.id, v);
    }

    return rows.map((r) => ({
      ...r,
      authorLabel: commentAuthorLabel(
        { actorType: r.actorType, actorUserId: r.actorUserId },
        staffById,
        vendorById,
      ),
    }));
  });
}

/**
 * Tenant display label for a unit, if any tenant_users rows exist.
 * Returns null when unknown — caller must not invent a name (ops #21).
 */
export async function tenantLabelForUnit(
  unitId: string | null | undefined,
): Promise<string | null> {
  if (!unitId) return null;
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({ name: tenantUsers.name, email: tenantUsers.email })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.orgId, ctx.orgId), eq(tenantUsers.unitId, unitId)));
    return formatTenantNames(rows);
  });
}
