import "server-only";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { savedViews } from "@db/schema/saved-views";
import { withStaffScope } from "./db";
import { ensureUserRow } from "./ensure-user";

export interface SavedViewRecord {
  id: string;
  name: string;
  params: string;
  pinned: boolean;
  sortOrder: number;
}

export const createSavedViewInput = z.object({
  name: z.string().trim().min(1).max(80),
  params: z.string().max(500),
  pinned: z.boolean().optional(),
});

/**
 * The current operator's saved views for the active org, pinned first then by
 * sortOrder, then oldest-created.
 *
 * DEFENSIVE READ: /work must never break because the migration hasn't been
 * applied to this DB yet. Any error (missing table, etc.) resolves to `[]`.
 */
export async function listSavedViews(): Promise<SavedViewRecord[]> {
  try {
    return await withStaffScope(async (tx, ctx) => {
      const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
      const rows = await tx
        .select({
          id: savedViews.id,
          name: savedViews.name,
          params: savedViews.params,
          pinned: savedViews.pinned,
          sortOrder: savedViews.sortOrder,
        })
        .from(savedViews)
        .where(and(eq(savedViews.orgId, ctx.orgId), eq(savedViews.userId, userId)))
        .orderBy(
          desc(savedViews.pinned),
          asc(savedViews.sortOrder),
          asc(savedViews.createdAt),
        );
      return rows;
    });
  } catch {
    // Table may not exist yet (migration unapplied) — never break /work.
    return [];
  }
}

export async function createSavedView(
  input: z.input<typeof createSavedViewInput>,
): Promise<string> {
  const p = createSavedViewInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const [row] = await tx
      .insert(savedViews)
      .values({
        orgId: ctx.orgId,
        userId,
        name: p.name,
        params: p.params,
        pinned: p.pinned ?? true,
      })
      .returning({ id: savedViews.id });
    return row!.id;
  });
}

export async function deleteSavedView(id: string): Promise<void> {
  const viewId = z.string().uuid().parse(id);
  await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    await tx
      .delete(savedViews)
      .where(
        and(
          eq(savedViews.orgId, ctx.orgId),
          eq(savedViews.userId, userId),
          eq(savedViews.id, viewId),
        ),
      );
  });
}

export async function togglePinSavedView(id: string): Promise<void> {
  const viewId = z.string().uuid().parse(id);
  await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const scope = and(
      eq(savedViews.orgId, ctx.orgId),
      eq(savedViews.userId, userId),
      eq(savedViews.id, viewId),
    );
    const [current] = await tx
      .select({ pinned: savedViews.pinned })
      .from(savedViews)
      .where(scope)
      .limit(1);
    if (!current) return;
    await tx
      .update(savedViews)
      .set({ pinned: !current.pinned, updatedAt: new Date() })
      .where(scope);
  });
}
