import "server-only";
import { z } from "zod";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { vendorUsers } from "@db/schema/vendor-users";
import {
  WORK_ORDER_KINDS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  canTransition,
  type WorkOrderStatus,
  type WorkOrderPriority,
} from "@contracts/state-machines/work-order";
import { withStaffScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { nextWorkOrderNumber } from "./sequence";
import { ensureUserRow } from "./sync-user";
import { emitNotification } from "./notifications";

/**
 * Build a `WHERE`-friendly LIKE pattern from a free-text query. Returns null
 * for empty/whitespace input so callers can omit the clause entirely.
 */
export function searchPattern(q: string | null | undefined): string | null {
  if (q === null || q === undefined) return null;
  const trimmed = q.trim();
  if (!trimmed) return null;
  // Escape ILIKE wildcards, then wrap in %…%.
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}

/** Coerce a possibly-numeric query into a WO number for "WO-1234" lookups. */
export function parseWoNumber(q: string | null | undefined): number | null {
  if (!q) return null;
  const trimmed = q.trim().toUpperCase();
  const m = /^WO-?(\d+)$/.exec(trimmed) ?? /^(\d+)$/.exec(trimmed);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
  priority: z.enum(WORK_ORDER_PRIORITIES).optional(),
  q: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export type ListFilter = z.infer<typeof listFilter>;

export async function listWorkOrders(filter: Partial<ListFilter> = {}) {
  const parsed = listFilter.parse(filter);
  const pattern = searchPattern(parsed.q ?? null);
  const woNumber = parseWoNumber(parsed.q ?? null);

  return withStaffScope(async (tx, ctx) => {
    const conditions: SQL[] = [eq(workOrders.orgId, ctx.orgId)];
    if (parsed.status) conditions.push(eq(workOrders.status, parsed.status));
    if (parsed.propertyId) conditions.push(eq(workOrders.propertyId, parsed.propertyId));
    if (parsed.unitId) conditions.push(eq(workOrders.unitId, parsed.unitId));
    if (parsed.priority) conditions.push(eq(workOrders.priority, parsed.priority));

    if (pattern || woNumber !== null) {
      const textOrNumber: SQL[] = [];
      if (pattern) {
        textOrNumber.push(ilike(workOrders.title, pattern));
        textOrNumber.push(ilike(workOrders.description, pattern));
      }
      if (woNumber !== null) {
        textOrNumber.push(eq(workOrders.number, woNumber));
      }
      const combined = or(...textOrNumber);
      if (combined) conditions.push(combined);
    }

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
  const result = await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const current = await getRow(tx, ctx.orgId, parsed.id);
    if (!current) throw new Error("work_order_not_found");
    if (current.status === parsed.to) return { wo: current, prev: current.status, fired: false, orgId: ctx.orgId };
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
    return { wo: updated[0]!, prev: current.status as WorkOrderStatus, fired: true, orgId: ctx.orgId };
  });

  // Notify on key transitions only. Recipient is the WO creator (staff)
  // for now; vendor is already notified via assignVendor.
  if (result.fired) {
    const interesting: WorkOrderStatus[] = ["blocked", "resolved", "verified"];
    if (interesting.includes(result.wo.status as WorkOrderStatus) && result.wo.createdByUserId) {
      const kindMap = {
        blocked: "wo_blocked",
        resolved: "wo_resolved",
        verified: "wo_verified",
      } as const;
      const kind = kindMap[result.wo.status as keyof typeof kindMap];
      await emitNotification({
        orgId: result.orgId,
        recipientUserId: result.wo.createdByUserId,
        kind,
        subject: `WO-${result.wo.number} → ${result.wo.status}`,
        body: `Status changed: ${result.prev} → ${result.wo.status}. Title: ${result.wo.title}`,
        targetType: "work_order",
        targetId: result.wo.id,
        // recipientEmail intentionally null here — we don't have it in scope
        // and resolving it would require another query. For now this records
        // an in_app notification only. P5 will add user-email lookup.
      });
    }
  }

  return result.wo;
}

export const assignVendorInput = z.object({
  workOrderId: z.string().uuid(),
  vendorUserId: z.string().uuid(),
});

export async function assignVendor(input: z.infer<typeof assignVendorInput>) {
  const parsed = assignVendorInput.parse(input);
  const result = await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);

    // Confirm the vendor_user belongs to this org and capture their contact.
    const vu = await tx
      .select({ id: vendorUsers.id, email: vendorUsers.email, phone: vendorUsers.phone, name: vendorUsers.name })
      .from(vendorUsers)
      .where(and(eq(vendorUsers.orgId, ctx.orgId), eq(vendorUsers.id, parsed.vendorUserId)))
      .limit(1);
    if (vu.length === 0) throw new Error("vendor_user_not_in_org");
    const vendor = vu[0]!;

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

    return {
      orgId: ctx.orgId,
      vendorUserId: parsed.vendorUserId,
      vendorEmail: vendor.email,
      vendorPhone: vendor.phone,
      workOrder: current,
    };
  });

  // Emit notification AFTER the transaction commits so the recipient
  // sees a row that actually exists.
  if (result.workOrder) {
    const wo = result.workOrder;
    await emitNotification({
      orgId: result.orgId,
      recipientVendorUserId: result.vendorUserId,
      recipientEmail: result.vendorEmail,
      recipientPhone: result.vendorPhone,
      kind: "wo_assigned",
      subject: `WO-${wo.number}: ${wo.title}`,
      body: `You've been assigned WO-${wo.number} "${wo.title}". Open the vendor portal to view details.`,
      targetType: "work_order",
      targetId: wo.id,
    });
  }
}

async function getRow(tx: ScopedDB, orgId: string, id: string) {
  const rows = await tx
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}
