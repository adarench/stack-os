import "server-only";
import { z } from "zod";
import { and, asc, eq, sql as drizzleSql } from "drizzle-orm";
import {
  inspectionItems,
  checklistTemplates,
  checklistTemplateItems,
} from "@db/schema/checklists";
import { withStaffScope, type ScopedDB } from "./db";
import { ensureUserRow } from "./ensure-user";

/* -------------------- inspection check-off items -------------------- */

export async function listInspectionItems(inspectionId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(inspectionItems)
      .where(
        and(
          eq(inspectionItems.orgId, ctx.orgId),
          eq(inspectionItems.inspectionId, inspectionId),
        ),
      )
      .orderBy(asc(inspectionItems.ordering), asc(inspectionItems.createdAt)),
  );
}

export const addInspectionItemInput = z.object({
  inspectionId: z.string().uuid(),
  title: z.string().min(1).max(300),
  ordering: z.number().int().optional(),
});

export async function addInspectionItem(input: z.input<typeof addInspectionItemInput>) {
  const p = addInspectionItemInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const ord = p.ordering ?? (await nextInspectionOrdering(tx, ctx.orgId, p.inspectionId));
    const [row] = await tx
      .insert(inspectionItems)
      .values({
        orgId: ctx.orgId,
        inspectionId: p.inspectionId,
        title: p.title,
        ordering: ord,
      })
      .returning();
    return row!;
  });
}

/** Toggle an item complete/incomplete. Stamps who + when on completion. */
export async function toggleInspectionItem(itemId: string) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const cur = (
      await tx
        .select({ completedAt: inspectionItems.completedAt })
        .from(inspectionItems)
        .where(and(eq(inspectionItems.orgId, ctx.orgId), eq(inspectionItems.id, itemId)))
        .limit(1)
    )[0];
    if (!cur) return null;
    const done = cur.completedAt === null;
    const [row] = await tx
      .update(inspectionItems)
      .set({
        completedAt: done ? new Date() : null,
        completedByUserId: done ? userId : null,
        updatedAt: new Date(),
      })
      .where(and(eq(inspectionItems.orgId, ctx.orgId), eq(inspectionItems.id, itemId)))
      .returning();
    return row ?? null;
  });
}

export async function removeInspectionItem(itemId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .delete(inspectionItems)
      .where(and(eq(inspectionItems.orgId, ctx.orgId), eq(inspectionItems.id, itemId))),
  );
}

async function nextInspectionOrdering(
  tx: ScopedDB,
  orgId: string,
  inspectionId: string,
): Promise<number> {
  const [r] = await tx
    .select({ max: drizzleSql<number>`coalesce(max(${inspectionItems.ordering}), -1)::int` })
    .from(inspectionItems)
    .where(and(eq(inspectionItems.orgId, orgId), eq(inspectionItems.inspectionId, inspectionId)));
  return (r?.max ?? -1) + 1;
}

/* -------------------- reusable checklist templates -------------------- */

export async function listChecklistTemplates() {
  return withStaffScope(async (tx, ctx) => {
    const tmpls = await tx
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.orgId, ctx.orgId))
      .orderBy(asc(checklistTemplates.name));
    const items = await tx
      .select()
      .from(checklistTemplateItems)
      .where(eq(checklistTemplateItems.orgId, ctx.orgId))
      .orderBy(asc(checklistTemplateItems.ordering), asc(checklistTemplateItems.createdAt));
    return tmpls.map((t) => ({
      ...t,
      items: items.filter((i) => i.templateId === t.id),
    }));
  });
}

export async function createChecklistTemplate(name: string) {
  return withStaffScope(async (tx, ctx) => {
    const [row] = await tx
      .insert(checklistTemplates)
      .values({ orgId: ctx.orgId, name: name.trim() })
      .returning();
    return row!;
  });
}

export const addTemplateItemInput = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(1).max(300),
});

export async function addChecklistTemplateItem(input: z.input<typeof addTemplateItemInput>) {
  const p = addTemplateItemInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const [r] = await tx
      .select({ max: drizzleSql<number>`coalesce(max(${checklistTemplateItems.ordering}), -1)::int` })
      .from(checklistTemplateItems)
      .where(and(eq(checklistTemplateItems.orgId, ctx.orgId), eq(checklistTemplateItems.templateId, p.templateId)));
    const [row] = await tx
      .insert(checklistTemplateItems)
      .values({
        orgId: ctx.orgId,
        templateId: p.templateId,
        title: p.title,
        ordering: (r?.max ?? -1) + 1,
      })
      .returning();
    return row!;
  });
}

export async function removeChecklistTemplateItem(itemId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .delete(checklistTemplateItems)
      .where(and(eq(checklistTemplateItems.orgId, ctx.orgId), eq(checklistTemplateItems.id, itemId))),
  );
}

/** Copy a template's items onto an inspection as fresh check-off items. */
export async function applyChecklistTemplate(inspectionId: string, templateId: string) {
  return withStaffScope(async (tx, ctx) => {
    const items = await tx
      .select()
      .from(checklistTemplateItems)
      .where(and(eq(checklistTemplateItems.orgId, ctx.orgId), eq(checklistTemplateItems.templateId, templateId)))
      .orderBy(asc(checklistTemplateItems.ordering), asc(checklistTemplateItems.createdAt));
    if (items.length === 0) return 0;
    await tx.insert(inspectionItems).values(
      items.map((i, idx) => ({
        orgId: ctx.orgId,
        inspectionId,
        title: i.title,
        ordering: idx,
      })),
    );
    return items.length;
  });
}
