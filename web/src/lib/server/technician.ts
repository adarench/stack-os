import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { users } from "@db/schema/users";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import { tenantUsers } from "@db/schema/compliance";
import { comments } from "@db/schema/comments";
import { attachments } from "@db/schema/attachments";
import { withStaffScope, type ScopedDB } from "./db";
import { ensureUserRow } from "./sync-user";
import { parseWoNumber, updateWorkOrderStatus } from "./work-orders";
import { createComment } from "./comments";
import { signReadUrl } from "./storage";
import { allowedNext, type WorkOrderStatus } from "@contracts/state-machines/work-order";

/**
 * Technician field workflow (M4 · TEC-*). Technicians are staff `users` with the
 * `technician` role; this surface scopes them to their OWN assigned work. RLS
 * enforces the org boundary; assignment ownership is enforced here at the app
 * layer (a technician can only see/act on WOs actively assigned to them).
 *
 * Status changes + completion reuse the authoritative `updateWorkOrderStatus`
 * (so a technician "complete" IS the completion — no redundant operator step,
 * TEC-009); messaging reuses `createComment` (external reply → resident).
 */

// Work still needing the technician's attention (excludes terminal states).
const QUEUE_STATUSES = ["assigned", "scheduled", "in_progress", "blocked", "resolved"] as const;

async function myUserId(tx: ScopedDB, ctx: { orgId: string; userId: string }): Promise<string> {
  return ensureUserRow(tx, ctx.orgId, ctx.userId);
}

async function assignedToMe(tx: ScopedDB, orgId: string, myId: string, woId: string): Promise<boolean> {
  const [a] = await tx
    .select({ id: assignments.id })
    .from(assignments)
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        eq(assignments.targetId, woId),
        eq(assignments.assigneeType, "user"),
        eq(assignments.assigneeId, myId),
        isNull(assignments.unassignedAt),
      ),
    )
    .limit(1);
  return !!a;
}

async function resolveMyWo(
  tx: ScopedDB,
  orgId: string,
  myId: string,
  ref: string,
): Promise<{ id: string; number: number; status: string } | null> {
  const num = parseWoNumber(ref);
  if (num === null) return null;
  const [wo] = await tx
    .select({ id: workOrders.id, number: workOrders.number, status: workOrders.status })
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.number, num)))
    .limit(1);
  if (!wo) return null;
  if (!(await assignedToMe(tx, orgId, myId, wo.id))) return null;
  return wo;
}

export interface TechQueueItem {
  ref: string;
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  property: string | null;
  unit: string | null;
  floor: string | null;
  suite: string | null;
  requester: string | null;
  acknowledged: boolean;
  createdAt: string;
}

/** The technician's assigned, still-active work. */
export async function loadTechnicianQueue(): Promise<TechQueueItem[]> {
  return withStaffScope(async (tx, ctx) => {
    const myId = await myUserId(tx, ctx);
    const rows = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        status: workOrders.status,
        priority: workOrders.priority,
        category: workOrders.category,
        acknowledgedAt: workOrders.acknowledgedAt,
        createdAt: workOrders.createdAt,
        property: properties.name,
        unit: units.label,
        floor: units.floor,
        suite: units.suite,
        requester: tenantUsers.name,
        requesterEmail: tenantUsers.email,
      })
      .from(workOrders)
      .innerJoin(
        assignments,
        and(
          eq(assignments.targetType, "work_order"),
          eq(assignments.targetId, workOrders.id),
          eq(assignments.assigneeType, "user"),
          eq(assignments.assigneeId, myId),
          isNull(assignments.unassignedAt),
        ),
      )
      .leftJoin(properties, eq(properties.id, workOrders.propertyId))
      .leftJoin(units, eq(units.id, workOrders.unitId))
      .leftJoin(tenantUsers, eq(tenantUsers.id, workOrders.createdByTenantUserId))
      .where(
        and(
          eq(workOrders.orgId, ctx.orgId),
          inArray(workOrders.status, [...QUEUE_STATUSES]),
        ),
      )
      .orderBy(desc(workOrders.priority), asc(workOrders.createdAt));

    return rows.map((r) => ({
      ref: `WO-${r.number}`,
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status,
      priority: r.priority,
      category: r.category,
      property: r.property,
      unit: r.unit,
      floor: r.floor,
      suite: r.suite,
      requester: r.requester ?? r.requesterEmail ?? null,
      acknowledged: !!r.acknowledgedAt,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export interface TechWorkOrderDetail extends TechQueueItem {
  description: string | null;
  requesterEmail: string | null;
  photos: Array<{ url: string; kind: string; isVideo: boolean }>;
  messages: Array<{ id: string; body: string; visibility: string; actorType: string; at: string }>;
  nextStatuses: string[];
  blockedReason: string | null;
}

/** Full detail for one assigned WO, or null if not assigned to the caller. */
export async function loadTechnicianWorkOrder(ref: string): Promise<TechWorkOrderDetail | null> {
  return withStaffScope(async (tx, ctx) => {
    const myId = await myUserId(tx, ctx);
    const num = parseWoNumber(ref);
    if (num === null) return null;

    const [wo] = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        description: workOrders.description,
        status: workOrders.status,
        priority: workOrders.priority,
        category: workOrders.category,
        blockedReason: workOrders.blockedReason,
        acknowledgedAt: workOrders.acknowledgedAt,
        createdAt: workOrders.createdAt,
        property: properties.name,
        unit: units.label,
        floor: units.floor,
        suite: units.suite,
        requester: tenantUsers.name,
        requesterEmail: tenantUsers.email,
      })
      .from(workOrders)
      .leftJoin(properties, eq(properties.id, workOrders.propertyId))
      .leftJoin(units, eq(units.id, workOrders.unitId))
      .leftJoin(tenantUsers, eq(tenantUsers.id, workOrders.createdByTenantUserId))
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.number, num)))
      .limit(1);
    if (!wo) return null;
    if (!(await assignedToMe(tx, ctx.orgId, myId, wo.id))) return null;

    const files = await tx
      .select({ storageKey: attachments.storageKey, kind: attachments.kind, contentType: attachments.contentType })
      .from(attachments)
      .where(
        and(
          eq(attachments.orgId, ctx.orgId),
          eq(attachments.targetType, "work_order"),
          eq(attachments.targetId, wo.id),
        ),
      )
      .orderBy(asc(attachments.ordering));
    const photos = await Promise.all(
      files.map(async (f) => ({
        url: await signReadUrl(f.storageKey),
        kind: f.kind,
        isVideo: (f.contentType ?? "").startsWith("video"),
      })),
    );

    const msgs = await tx
      .select({
        id: comments.id,
        body: comments.body,
        visibility: comments.visibility,
        actorType: comments.actorType,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(
        and(
          eq(comments.orgId, ctx.orgId),
          eq(comments.targetType, "work_order"),
          eq(comments.targetId, wo.id),
        ),
      )
      .orderBy(asc(comments.createdAt));

    return {
      ref: `WO-${wo.number}`,
      id: wo.id,
      number: wo.number,
      title: wo.title,
      description: wo.description,
      status: wo.status,
      priority: wo.priority,
      category: wo.category,
      blockedReason: wo.blockedReason,
      property: wo.property,
      unit: wo.unit,
      floor: wo.floor,
      suite: wo.suite,
      requester: wo.requester ?? wo.requesterEmail ?? null,
      requesterEmail: wo.requesterEmail,
      acknowledged: !!wo.acknowledgedAt,
      createdAt: wo.createdAt.toISOString(),
      photos,
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        visibility: m.visibility,
        actorType: m.actorType,
        at: m.createdAt.toISOString(),
      })),
      nextStatuses: [...allowedNext(wo.status as WorkOrderStatus)],
    } as TechWorkOrderDetail;
  });
}

/** Verify the caller is assigned to `ref`, returning its WO id (throws otherwise). */
async function requireMyWo(ref: string): Promise<{ id: string }> {
  const wo = await withStaffScope(async (tx, ctx) => {
    const myId = await myUserId(tx, ctx);
    return resolveMyWo(tx, ctx.orgId, myId, ref);
  });
  if (!wo) throw new Error("not_found");
  return { id: wo.id };
}

/** Acknowledge (mark seen) — stamps acknowledgedAt if not already set. */
export async function techAcknowledge(ref: string): Promise<void> {
  await withStaffScope(async (tx, ctx) => {
    const myId = await myUserId(tx, ctx);
    const wo = await resolveMyWo(tx, ctx.orgId, myId, ref);
    if (!wo) throw new Error("not_found");
    await tx
      .update(workOrders)
      .set({ acknowledgedAt: new Date(), acknowledgedByUserId: myId })
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.id, wo.id), isNull(workOrders.acknowledgedAt)));
  });
}

const techStatusInput = z.object({
  ref: z.string(),
  to: z.enum(["scheduled", "in_progress", "blocked", "resolved"]),
});

/** Update status (start / block / complete) — reuses the authoritative writer. */
export async function techSetStatus(input: z.infer<typeof techStatusInput>): Promise<void> {
  const parsed = techStatusInput.parse(input);
  const { id } = await requireMyWo(parsed.ref);
  await updateWorkOrderStatus({ id, to: parsed.to });
}

/** Technician marks the job complete (authoritative — no operator step). */
export async function techComplete(ref: string): Promise<void> {
  const { id } = await requireMyWo(ref);
  await updateWorkOrderStatus({ id, to: "resolved" });
}

/** Internal team note (not visible to the requester). */
export async function techAddNote(ref: string, body: string): Promise<void> {
  const { id } = await requireMyWo(ref);
  await createComment({ targetType: "work_order", targetId: id, body, visibility: "internal" });
}

/** Reply to the requester (external — reaches the resident + notifies). */
export async function techReplyToRequester(ref: string, body: string): Promise<void> {
  const { id } = await requireMyWo(ref);
  await createComment({ targetType: "work_order", targetId: id, body, visibility: "external" });
}
