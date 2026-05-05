import "server-only";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { vendorUsers } from "@db/schema/vendor-users";
import {
  WORK_ORDER_KINDS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  canTransition,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";
import { withStaffScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { nextWorkOrderNumber } from "./sequence";
import { ensureUserRow } from "./sync-user";

export const createWorkOrderInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  kind: z.enum(WORK_ORDER_KINDS).default("work_order"),
  priority: z.enum(WORK_ORDER_PRIORITIES).default("normal"),
  propertyId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  dueAt: z.coerce.date().optional(),
  scheduledFor: z.coerce.date().optional(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderInput>;

export async function createWorkOrder(input: CreateWorkOrderInput) {
  const parsed = createWorkOrderInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const number = await nextWorkOrderNumber(tx, ctx.orgId);
    const inserted = await tx
      .insert(workOrders)
      .values({
        orgId: ctx.orgId,
        number,
        title: parsed.title,
        description: parsed.description ?? null,
        kind: parsed.kind,
        status: "new",
        priority: parsed.priority,
        propertyId: parsed.propertyId ?? null,
        unitId: parsed.unitId ?? null,
        dueAt: parsed.dueAt ?? null,
        scheduledFor: parsed.scheduledFor ?? null,
        createdByUserId: userId,
        createdByActorType: "user",
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "work_order",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { to: { status: "new", title: parsed.title } },
    });
    return row;
  });
}

export const listFilter = z.object({
  status: z.enum(WORK_ORDER_STATUSES).optional(),
  propertyId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export type ListFilter = z.infer<typeof listFilter>;

export async function listWorkOrders(filter: Partial<ListFilter> = {}) {
  const parsed = listFilter.parse(filter);
  return withStaffScope(async (tx, ctx) => {
    const conditions = [eq(workOrders.orgId, ctx.orgId)];
    if (parsed.status) conditions.push(eq(workOrders.status, parsed.status));
    if (parsed.propertyId) conditions.push(eq(workOrders.propertyId, parsed.propertyId));
    if (parsed.unitId) conditions.push(eq(workOrders.unitId, parsed.unitId));
    return tx
      .select()
      .from(workOrders)
      .where(and(...conditions))
      .orderBy(desc(workOrders.createdAt))
      .limit(parsed.limit);
  });
}

export async function getWorkOrder(id: string) {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.id, id)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export const updateStatusInput = z.object({
  id: z.string().uuid(),
  to: z.enum(WORK_ORDER_STATUSES),
});

export async function updateWorkOrderStatus(
  input: z.infer<typeof updateStatusInput>,
) {
  const parsed = updateStatusInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const current = await getRow(tx, ctx.orgId, parsed.id);
    if (!current) throw new Error("work_order_not_found");
    if (current.status === parsed.to) return current;
    if (!canTransition(current.status as WorkOrderStatus, parsed.to)) {
      throw new Error(`invalid_transition:${current.status}->${parsed.to}`);
    }
    const patch: Partial<typeof workOrders.$inferInsert> = {
      status: parsed.to,
      updatedAt: new Date(),
    };
    if (parsed.to === "in_progress" && !current.startedAt) patch.startedAt = new Date();
    if (parsed.to === "resolved") patch.completedAt = new Date();

    const updated = await tx
      .update(workOrders)
      .set(patch)
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.id, parsed.id)))
      .returning();

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "work_order",
      targetId: parsed.id,
      action: "status_changed",
      actorUserId: userId,
      diff: { from: { status: current.status }, to: { status: parsed.to } },
    });
    return updated[0]!;
  });
}

export const assignVendorInput = z.object({
  workOrderId: z.string().uuid(),
  vendorUserId: z.string().uuid(),
});

export async function assignVendor(input: z.infer<typeof assignVendorInput>) {
  const parsed = assignVendorInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);

    // Confirm the vendor_user belongs to this org.
    const vu = await tx
      .select({ id: vendorUsers.id })
      .from(vendorUsers)
      .where(and(eq(vendorUsers.orgId, ctx.orgId), eq(vendorUsers.id, parsed.vendorUserId)))
      .limit(1);
    if (vu.length === 0) throw new Error("vendor_user_not_in_org");

    await tx.insert(assignments).values({
      orgId: ctx.orgId,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      assigneeType: "vendor_user",
      assigneeId: parsed.vendorUserId,
      assignedByUserId: userId,
    });

    // If the WO is in "new" or "triaged", advance to "assigned".
    const current = await getRow(tx, ctx.orgId, parsed.workOrderId);
    if (current && (current.status === "new" || current.status === "triaged")) {
      await tx
        .update(workOrders)
        .set({ status: "assigned", updatedAt: new Date() })
        .where(eq(workOrders.id, parsed.workOrderId));
      await writeAudit(tx, {
        orgId: ctx.orgId,
        targetType: "work_order",
        targetId: parsed.workOrderId,
        action: "status_changed",
        actorUserId: userId,
        diff: { from: { status: current.status }, to: { status: "assigned" } },
      });
    }

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      action: "vendor_assigned",
      actorUserId: userId,
      diff: { vendorUserId: parsed.vendorUserId },
    });
  });
}

async function getRow(tx: ScopedDB, orgId: string, id: string) {
  const rows = await tx
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}
