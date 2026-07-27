import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withVendorScope } from "./db";
import { workOrders } from "@db/schema/work-orders";
import { comments } from "@db/schema/comments";
import type { VendorSession } from "./vendor-auth";
import { parseWoNumber } from "./work-orders";
import { workOrderCategoryLabel } from "@contracts/work-order-category";

/**
 * External-vendor workflow (M9, VEN — post-pilot).
 *
 * A vendor_user can *view* the work orders assigned to them and *message* on
 * them. Both reads and the message insert run under `withVendorScope`, so the
 * RLS policies (`work_orders_vendor_assigned`, `comments_vendor_external`,
 * `comments_vendor_insert`) are the enforcement boundary — this module never
 * bypasses them. Vendor comments are always `external` (RLS forbids a vendor
 * inserting internal notes), so they are visible to operators.
 *
 * Deliberately out of scope for M9: vendors changing WO *status* / completing
 * authoritatively. External-party writes to the state machine warrant a
 * dedicated design (operator mediation vs. new vendor-scoped write plumbing +
 * policies) and this is post-pilot — so the authoritative writer stays
 * operator/technician-only for now.
 */

export interface VendorMessage {
  id: string;
  body: string;
  fromVendor: boolean;
  at: string;
}

export interface VendorWorkOrderDetail {
  id: string;
  ref: string; // WO-123
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
  messages: VendorMessage[];
}

/** One assigned WO's detail + its external thread. RLS returns null if the
 *  vendor_user is not (or is no longer) assigned to it. */
export async function loadVendorWorkOrder(
  session: VendorSession,
  ref: string,
): Promise<VendorWorkOrderDetail | null> {
  const number = parseWoNumber(ref);
  if (number === null) return null;

  return withVendorScope(session, async (tx) => {
    const [wo] = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        description: workOrders.description,
        category: workOrders.category,
        status: workOrders.status,
        priority: workOrders.priority,
        dueAt: workOrders.dueAt,
        createdAt: workOrders.createdAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.number, number)))
      .limit(1);
    if (!wo) return null; // not assigned (RLS) or no such WO

    const msgs = await tx
      .select({
        id: comments.id,
        body: comments.body,
        actorType: comments.actorType,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(
        and(
          eq(comments.orgId, session.orgId),
          eq(comments.targetType, "work_order"),
          eq(comments.targetId, wo.id),
          eq(comments.visibility, "external"),
        ),
      )
      .orderBy(asc(comments.createdAt));

    return {
      id: wo.id,
      ref: `WO-${wo.number}`,
      title: wo.title,
      description: wo.description,
      category: workOrderCategoryLabel(wo.category),
      status: wo.status,
      priority: wo.priority,
      dueAt: wo.dueAt ? wo.dueAt.toISOString() : null,
      createdAt: wo.createdAt.toISOString(),
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        fromVendor: m.actorType === "vendor",
        at: m.createdAt.toISOString(),
      })),
    };
  });
}

export const vendorMessageInput = z.object({
  workOrderId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

/** Vendor posts an (external) message on an assigned WO. RLS double-guards:
 *  the WITH CHECK on `comments_vendor_insert` requires a live assignment. */
export async function vendorPostMessage(
  session: VendorSession,
  input: z.input<typeof vendorMessageInput>,
): Promise<void> {
  const parsed = vendorMessageInput.parse(input);
  await withVendorScope(session, async (tx) => {
    // Confirm the WO is visible (i.e. assigned) under vendor RLS before writing,
    // for a clean error rather than an RLS violation.
    const [wo] = await tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.id, parsed.workOrderId)))
      .limit(1);
    if (!wo) throw new Error("not_found_or_not_assigned");

    await tx.insert(comments).values({
      orgId: session.orgId,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      body: parsed.body,
      actorType: "vendor",
      actorUserId: session.vendorUserId,
      visibility: "external",
    });
  });
}
