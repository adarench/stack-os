import "server-only";
import { z } from "zod";
import { and, asc, eq, sql as drizzleSql } from "drizzle-orm";
import { taskCosts, taskTimeEntries } from "@db/schema/financials";
import { COST_KINDS, type CostKind } from "@contracts/financials";
import { withStaffScope, withVendorScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const addCostInput = z.object({
  workOrderId: z.string().uuid(),
  kind: z.enum(COST_KINDS).default("other"),
  description: z.string().max(500).optional(),
  amountCents: z.number().int().min(0),
});

export async function addCost(input: z.input<typeof addCostInput>) {
  const parsed = addCostInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(taskCosts)
      .values({
        orgId: ctx.orgId,
        workOrderId: parsed.workOrderId,
        kind: parsed.kind,
        description: parsed.description ?? null,
        amountCents: String(parsed.amountCents),
        enteredByActorType: "user",
        enteredByUserId: userId,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      action: "cost_added",
      actorUserId: userId,
      diff: { kind: parsed.kind, amountCents: parsed.amountCents },
    });
    return row;
  });
}

export async function addCostFromVendor(
  ctx: { orgId: string; vendorUserId: string },
  input: Omit<z.input<typeof addCostInput>, never>,
) {
  const parsed = addCostInput.parse(input);
  return withVendorScope(ctx, async (tx) => {
    const inserted = await tx
      .insert(taskCosts)
      .values({
        orgId: ctx.orgId,
        workOrderId: parsed.workOrderId,
        kind: parsed.kind,
        description: parsed.description ?? null,
        amountCents: String(parsed.amountCents),
        enteredByActorType: "vendor",
        enteredByVendorUserId: ctx.vendorUserId,
      })
      .returning();
    return inserted[0]!;
  });
}

export async function listCosts(workOrderId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(taskCosts)
      .where(
        and(eq(taskCosts.orgId, ctx.orgId), eq(taskCosts.workOrderId, workOrderId)),
      )
      .orderBy(asc(taskCosts.createdAt)),
  );
}

export async function totalForWorkOrder(workOrderId: string): Promise<number> {
  return withStaffScope(async (tx, ctx) => {
    const r = await tx
      .select({
        sum: drizzleSql<string | null>`coalesce(sum(${taskCosts.amountCents}), 0)`,
      })
      .from(taskCosts)
      .where(
        and(eq(taskCosts.orgId, ctx.orgId), eq(taskCosts.workOrderId, workOrderId)),
      );
    const raw = r[0]?.sum ?? "0";
    return Number(raw);
  });
}

/** Aggregate totals by kind for a single WO. */
export async function costBreakdown(workOrderId: string): Promise<
  Record<CostKind, number>
> {
  const rows = await listCosts(workOrderId);
  const out: Record<CostKind, number> = {
    labor: 0,
    materials: 0,
    fee: 0,
    other: 0,
  };
  for (const r of rows) {
    out[r.kind as CostKind] += Number(r.amountCents);
  }
  return out;
}

export const addTimeEntryInput = z.object({
  workOrderId: z.string().uuid(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  hoursDecimal: z.number().min(0).optional(),
  hourlyRateCents: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export async function addTimeEntry(input: z.input<typeof addTimeEntryInput>) {
  const parsed = addTimeEntryInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(taskTimeEntries)
      .values({
        orgId: ctx.orgId,
        workOrderId: parsed.workOrderId,
        userId,
        startedAt: parsed.startedAt,
        endedAt: parsed.endedAt ?? null,
        hoursDecimal: parsed.hoursDecimal ?? null,
        hourlyRateCents:
          parsed.hourlyRateCents != null ? String(parsed.hourlyRateCents) : null,
        notes: parsed.notes ?? null,
      })
      .returning();
    return inserted[0]!;
  });
}

export async function listTimeEntries(workOrderId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.orgId, ctx.orgId),
          eq(taskTimeEntries.workOrderId, workOrderId),
        ),
      )
      .orderBy(asc(taskTimeEntries.startedAt)),
  );
}
