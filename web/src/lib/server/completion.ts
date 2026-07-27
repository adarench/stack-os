import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { tenantUsers } from "@db/schema/compliance";
import { comments } from "@db/schema/comments";
import { attachments } from "@db/schema/attachments";
import { assignments } from "@db/schema/assignments";
import { users } from "@db/schema/users";
import type { ScopedDB } from "./db";

/**
 * Structured completion summary (M5 · SUM-001/002). A deterministic snapshot
 * assembled from the work order's own history at completion — no AI, always
 * verifiable. Persisted on `work_orders.completion_summary` (jsonb) so tenant /
 * technician / operator read it through the existing WO RLS. `photoKeys` are
 * storage keys; sign them on read.
 */
export interface CompletionSummary {
  version: 1;
  woNumber: number;
  title: string;
  category: string | null;
  originalIssue: string | null;
  location: { property: string | null; floor: string | null; suite: string | null; unit: string | null };
  requester: { name: string | null; email: string | null } | null;
  technician: string | null;
  workPerformed: string[];
  photoKeys: string[];
  completedAt: string;
  completedByUserId: string;
  finalStatus: string;
}

export async function buildCompletionSummary(
  tx: ScopedDB,
  orgId: string,
  woId: string,
  completedByUserId: string,
  now: Date,
): Promise<CompletionSummary | null> {
  const [wo] = await tx
    .select({
      number: workOrders.number,
      title: workOrders.title,
      category: workOrders.category,
      description: workOrders.description,
      propertyId: workOrders.propertyId,
      unitId: workOrders.unitId,
      tenantUserId: workOrders.createdByTenantUserId,
    })
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.id, woId)))
    .limit(1);
  if (!wo) return null;

  let property: string | null = null;
  let floor: string | null = null;
  let suite: string | null = null;
  let unit: string | null = null;
  if (wo.unitId) {
    const [u] = await tx
      .select({ label: units.label, floor: units.floor, suite: units.suite, propertyId: units.propertyId })
      .from(units)
      .where(eq(units.id, wo.unitId))
      .limit(1);
    if (u) {
      unit = u.label;
      floor = u.floor;
      suite = u.suite;
      if (u.propertyId) {
        const [p] = await tx.select({ name: properties.name }).from(properties).where(eq(properties.id, u.propertyId)).limit(1);
        property = p?.name ?? null;
      }
    }
  } else if (wo.propertyId) {
    const [p] = await tx.select({ name: properties.name }).from(properties).where(eq(properties.id, wo.propertyId)).limit(1);
    property = p?.name ?? null;
  }

  let requester: { name: string | null; email: string | null } | null = null;
  if (wo.tenantUserId) {
    const [t] = await tx
      .select({ name: tenantUsers.name, email: tenantUsers.email })
      .from(tenantUsers)
      .where(eq(tenantUsers.id, wo.tenantUserId))
      .limit(1);
    if (t) requester = { name: t.name, email: t.email };
  }

  const [assignRow] = await tx
    .select({ assigneeId: assignments.assigneeId })
    .from(assignments)
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        eq(assignments.targetId, woId),
        eq(assignments.assigneeType, "user"),
        isNull(assignments.unassignedAt),
      ),
    )
    .limit(1);
  let technician: string | null = null;
  if (assignRow?.assigneeId) {
    const [u] = await tx.select({ name: users.name }).from(users).where(eq(users.id, assignRow.assigneeId)).limit(1);
    technician = u?.name ?? null;
  }

  // "Work performed" = the internal notes the technician logged.
  const notes = await tx
    .select({ body: comments.body })
    .from(comments)
    .where(
      and(
        eq(comments.orgId, orgId),
        eq(comments.targetType, "work_order"),
        eq(comments.targetId, woId),
        eq(comments.visibility, "internal"),
      ),
    )
    .orderBy(asc(comments.createdAt));

  const photoRows = await tx
    .select({ key: attachments.storageKey })
    .from(attachments)
    .where(
      and(
        eq(attachments.orgId, orgId),
        eq(attachments.targetType, "work_order"),
        eq(attachments.targetId, woId),
      ),
    )
    .orderBy(asc(attachments.ordering));

  return {
    version: 1,
    woNumber: wo.number,
    title: wo.title,
    category: wo.category,
    originalIssue: wo.description,
    location: { property, floor, suite, unit },
    requester,
    technician,
    workPerformed: notes.map((n) => n.body),
    photoKeys: photoRows.map((p) => p.key),
    completedAt: now.toISOString(),
    completedByUserId,
    finalStatus: "resolved",
  };
}
