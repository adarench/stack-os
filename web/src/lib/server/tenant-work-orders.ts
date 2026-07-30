import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { withTenantScope, withScope } from "./db";
import { workOrders } from "@db/schema/work-orders";
import { comments } from "@db/schema/comments";
import { assignments } from "@db/schema/assignments";
import { orgSettings } from "@db/schema/commercial";
import { tenantUsers } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import { attachments } from "@db/schema/attachments";
import { users } from "@db/schema/users";
import { parseWoNumber } from "./work-orders";
import { ATTACHMENT_KINDS } from "@contracts/polymorphic";
import { WORK_ORDER_CATEGORIES } from "@contracts/work-order-category";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";
import { nextWorkOrderNumber } from "./sequence";
import { writeAudit } from "./audit";
import { emitNotification, notifyOpsTeam } from "./notifications";
import { saveTenantPushSubscription, pruneTenantPushSubscription } from "./push";
import { saveTenantDeviceToken, pruneTenantDeviceToken } from "./apns";
import { tenantPushSubscriptions, tenantDeviceTokens } from "@db/schema/push-subscriptions";
import type { TenantSession } from "./tenant-auth";

export const tenantSubmitInput = z.object({
  category: z.enum(WORK_ORDER_CATEGORIES),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  priority: z.enum(WORK_ORDER_PRIORITIES).default("normal"),
});
export type TenantSubmitInput = z.input<typeof tenantSubmitInput>;

/**
 * Tenant submits a work order. Pattern: validate ownership under tenant RLS,
 * then perform the privileged write under a system scope (WO-number generation
 * needs org-wide visibility that tenant RLS restricts). Unit/property are
 * derived from the *session*, never trusted from client input. Attribution
 * records the tenant via createdByActorType + createdByTenantUserId + audit.
 */
export async function createWorkOrderFromTenant(
  session: TenantSession,
  input: TenantSubmitInput,
) {
  const parsed = tenantSubmitInput.parse(input);

  const scope = await withTenantScope(session, async (tx) => {
    const [me] = await tx
      .select({
        unitId: tenantUsers.unitId,
        propertyId: units.propertyId,
        coveringUserId: properties.defaultAssigneeUserId,
      })
      .from(tenantUsers)
      .leftJoin(units, eq(units.id, tenantUsers.unitId))
      .leftJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(tenantUsers.id, session.tenantUserId))
      .limit(1);
    return me ?? null;
  });
  if (!scope?.unitId) throw new Error("tenant_has_no_unit");

  const result = await withScope(
    { orgId: session.orgId, actorType: "system" },
    async (tx) => {
      // ASN-001/003/008: resolve an assignee BEFORE insert so a resident WO
      // auto-assigns on submit and is never silently left unassigned. Priority:
      // (1) the building/property covering tech; (2) the org-level fallback.
      let tech: { id: string; email: string | null; phone: string | null } | null = null;
      let routingReason = "property_routing";
      const lookupTech = async (userId: string) => {
        const [u] = await tx
          .select({ id: users.id, email: users.email, phone: users.phone })
          .from(users)
          .where(and(eq(users.orgId, session.orgId), eq(users.id, userId)))
          .limit(1);
        return u ?? null;
      };
      if (scope.coveringUserId) {
        tech = await lookupTech(scope.coveringUserId);
      }
      if (!tech) {
        const [settings] = await tx
          .select({ fallback: orgSettings.fallbackAssigneeUserId })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, session.orgId))
          .limit(1);
        if (settings?.fallback) {
          tech = await lookupTech(settings.fallback);
          if (tech) routingReason = "org_fallback";
        }
      }

      const number = await nextWorkOrderNumber(tx, session.orgId);
      const [row] = await tx
        .insert(workOrders)
        .values({
          orgId: session.orgId,
          number,
          title: parsed.title,
          description: parsed.description ?? null,
          category: parsed.category,
          status: tech ? "assigned" : "new", // auto-route when a covering tech exists
          priority: parsed.priority ?? "normal",
          propertyId: scope.propertyId ?? null,
          unitId: scope.unitId,
          createdByActorType: "tenant",
          createdByTenantUserId: session.tenantUserId,
        })
        .returning();
      await writeAudit(tx, {
        orgId: session.orgId,
        targetType: "work_order",
        targetId: row!.id,
        action: "tenant_submitted",
        actorType: "tenant",
        diff: { to: { status: row!.status, title: parsed.title, category: parsed.category } },
      });

      if (tech) {
        await tx.insert(assignments).values({
          orgId: session.orgId,
          targetType: "work_order",
          targetId: row!.id,
          assigneeType: "user",
          assigneeId: tech.id,
          assignedByUserId: null, // system auto-route, not an operator action
        });
        await writeAudit(tx, {
          orgId: session.orgId,
          targetType: "work_order",
          targetId: row!.id,
          action: "auto_assigned",
          actorType: "system",
          diff: { to: { assigneeUserId: tech.id }, reason: routingReason },
        });
      }
      return { row: row!, tech };
    },
  );

  if (result.tech) {
    await emitNotification({
      orgId: session.orgId,
      recipientUserId: result.tech.id,
      recipientEmail: result.tech.email ?? undefined,
      recipientPhone: result.tech.phone ?? undefined,
      kind: "wo_submitted",
      subject: `New tenant request WO-${result.row.number}: ${result.row.title}`,
      body: `A resident reported an issue (${parsed.category}). Open Work to triage.`,
      targetType: "work_order",
      targetId: result.row.id,
      url: `/tech/WO-${result.row.number}`,
      actor: { type: "system" },
    });
  }

  // Notify the ops team about every new request (email + push + in_app) so they
  // don't have to keep checking — except the assigned tech, who's already pinged.
  await notifyOpsTeam({
    orgId: session.orgId,
    excludeUserId: result.tech?.id ?? null,
    kind: "wo_submitted",
    subject: `New request WO-${result.row.number}: ${result.row.title}`,
    body: `A resident reported an issue (${parsed.category}).`,
    targetType: "work_order",
    targetId: result.row.id,
    url: `/work-orders/${result.row.id}`,
    sms: true, // CPM/admin gets a new-request text (key event)
    dedupeKey: `wo_submitted:${result.row.id}`,
  });

  return result.row;
}

/** True if the work order is on the tenant's unit (RLS-enforced). */
export async function tenantOwnsWorkOrder(
  session: TenantSession,
  workOrderId: string,
): Promise<boolean> {
  return withTenantScope(session, async (tx) => {
    const [r] = await tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.id, workOrderId)))
      .limit(1);
    return !!r;
  });
}

export const tenantAttachInput = z.object({
  workOrderId: z.string().uuid(),
  storageKey: z.string().min(1).max(500),
  contentType: z.string().min(1).max(120),
  filename: z.string().max(200).optional(),
  sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
  kind: z.enum(ATTACHMENT_KINDS).default("general"),
});

/** Attach an uploaded file to the tenant's own work order (validated). */
export async function attachTenantUpload(
  session: TenantSession,
  input: z.input<typeof tenantAttachInput>,
) {
  const parsed = tenantAttachInput.parse(input);
  if (!(await tenantOwnsWorkOrder(session, parsed.workOrderId))) {
    throw new Error("not_found");
  }
  return withScope({ orgId: session.orgId, actorType: "system" }, async (tx) => {
    const [row] = await tx
      .insert(attachments)
      .values({
        orgId: session.orgId,
        targetType: "work_order",
        targetId: parsed.workOrderId,
        kind: parsed.kind,
        storageKey: parsed.storageKey,
        contentType: parsed.contentType,
        sizeBytes: parsed.sizeBytes ?? null,
        filename: parsed.filename ?? null,
        uploadedByActorType: "tenant",
      })
      .returning();
    await writeAudit(tx, {
      orgId: session.orgId,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      action: "attachment_added",
      actorType: "tenant",
      diff: { attachmentId: row!.id, kind: parsed.kind, filename: parsed.filename },
    });
    return row!;
  });
}

/* -------------------- messaging (tenant ↔ ops) -------------------- */

export interface TenantMessage {
  id: string;
  body: string;
  fromTenant: boolean;
  at: string;
}

/** External comment thread on the resident's own-unit WO (RLS-guarded). */
export async function loadTenantMessages(
  session: TenantSession,
  ref: string,
): Promise<TenantMessage[]> {
  const number = parseWoNumber(ref);
  if (number === null) return [];
  return withTenantScope(session, async (tx) => {
    const [wo] = await tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.number, number)))
      .limit(1);
    if (!wo) return [];
    const rows = await tx
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
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      fromTenant: r.actorType === "tenant",
      at: r.createdAt.toISOString(),
    }));
  });
}

export const tenantCommentInput = z.object({
  workOrderId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

/** Tenant posts a message (external comment) on their own WO. */
export async function createTenantComment(
  session: TenantSession,
  input: z.input<typeof tenantCommentInput>,
) {
  const parsed = tenantCommentInput.parse(input);
  if (!(await tenantOwnsWorkOrder(session, parsed.workOrderId))) {
    throw new Error("not_found");
  }
  const result = await withScope(
    { orgId: session.orgId, actorType: "system" },
    async (tx) => {
      const [row] = await tx
        .insert(comments)
        .values({
          orgId: session.orgId,
          targetType: "work_order",
          targetId: parsed.workOrderId,
          body: parsed.body,
          actorType: "tenant",
          actorUserId: session.tenantUserId,
          visibility: "external",
        })
        .returning();
      await writeAudit(tx, {
        orgId: session.orgId,
        targetType: "work_order",
        targetId: parsed.workOrderId,
        action: "tenant_commented",
        actorType: "tenant",
        diff: { commentId: row!.id },
      });

      // MSG-010 fix: an inbound resident message is a tenant update — stamp the WO
      // so the ops "tenant not updated" lens clears (parity with staff externals).
      await tx
        .update(workOrders)
        .set({ tenantUpdatedAt: new Date() })
        .where(eq(workOrders.id, parsed.workOrderId));

      const [wo] = await tx
        .select({
          number: workOrders.number,
          title: workOrders.title,
          propertyId: workOrders.propertyId,
        })
        .from(workOrders)
        .where(eq(workOrders.id, parsed.workOrderId))
        .limit(1);
      let tech: { id: string; email: string | null; phone: string | null } | null = null;
      if (wo?.propertyId) {
        const [p] = await tx
          .select({ coveringUserId: properties.defaultAssigneeUserId })
          .from(properties)
          .where(eq(properties.id, wo.propertyId))
          .limit(1);
        if (p?.coveringUserId) {
          const [u] = await tx
            .select({ id: users.id, email: users.email, phone: users.phone })
            .from(users)
            .where(eq(users.id, p.coveringUserId))
            .limit(1);
          tech = u ?? null;
        }
      }
      return { row: row!, wo, tech };
    },
  );

  if (result.tech && result.wo) {
    await emitNotification({
      orgId: session.orgId,
      recipientUserId: result.tech.id,
      recipientEmail: result.tech.email ?? undefined,
      recipientPhone: result.tech.phone ?? undefined,
      kind: "wo_message",
      subject: `New message on WO-${result.wo.number}`,
      body: `A resident replied on ${result.wo.title}.`,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      url: `/tech/WO-${result.wo.number}`,
      actor: { type: "system" },
    });
  }
  return result.row;
}

/* -------------------- resolution: confirm / reopen -------------------- */

async function coveringTech(
  tx: import("./db").ScopedDB,
  propertyId: string | null,
): Promise<{ id: string; email: string | null; phone: string | null } | null> {
  if (!propertyId) return null;
  const [p] = await tx
    .select({ c: properties.defaultAssigneeUserId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!p?.c) return null;
  const [u] = await tx
    .select({ id: users.id, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, p.c))
    .limit(1);
  return u ?? null;
}

/** Load the tenant's own WO for a transition (RLS-guarded). */
async function tenantWoForTransition(session: TenantSession, workOrderId: string) {
  return withTenantScope(session, async (tx) => {
    const [wo] = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        status: workOrders.status,
        propertyId: workOrders.propertyId,
      })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.id, workOrderId)))
      .limit(1);
    return wo ?? null;
  });
}

/**
 * Tenant confirms the work is done: resolved → verified. ONLY valid from
 * `resolved` (the server fn is the gate on which transition is allowed; tenant
 * writes run under a validated system scope, never arbitrary).
 */
export async function tenantConfirmResolved(session: TenantSession, workOrderId: string) {
  const wo = await tenantWoForTransition(session, workOrderId);
  if (!wo) throw new Error("not_found");
  if (wo.status !== "resolved") throw new Error("not_confirmable");

  const tech = await withScope(
    { orgId: session.orgId, actorType: "system" },
    async (tx) => {
      await tx
        .update(workOrders)
        .set({ status: "verified", updatedAt: new Date() })
        .where(eq(workOrders.id, workOrderId));
      await writeAudit(tx, {
        orgId: session.orgId,
        targetType: "work_order",
        targetId: workOrderId,
        action: "tenant_confirmed_resolved",
        actorType: "tenant",
        diff: { from: { status: "resolved" }, to: { status: "verified" } },
      });
      return coveringTech(tx, wo.propertyId);
    },
  );

  if (tech) {
    await emitNotification({
      orgId: session.orgId,
      recipientUserId: tech.id,
      recipientEmail: tech.email ?? undefined,
      // No SMS on confirm — positive closure, not a key-event text (email+push only).
      kind: "wo_verified",
      subject: `Resident confirmed WO-${wo.number} is fixed`,
      body: `The resident verified ${wo.title}. Ready to close.`,
      targetType: "work_order",
      targetId: workOrderId,
      url: `/tech/WO-${wo.number}`,
      actor: { type: "system" },
    });
  }
  return wo;
}

export const tenantReopenInput = z.object({
  workOrderId: z.string().uuid(),
  note: z.string().min(1).max(5000),
});

/**
 * Tenant reports it's NOT fixed: resolved → in_progress, posts their note as an
 * external comment, and notifies ops. Only valid from `resolved`.
 */
export async function tenantReopen(
  session: TenantSession,
  input: z.input<typeof tenantReopenInput>,
) {
  const parsed = tenantReopenInput.parse(input);
  const wo = await tenantWoForTransition(session, parsed.workOrderId);
  if (!wo) throw new Error("not_found");
  if (wo.status !== "resolved") throw new Error("not_reopenable");

  const tech = await withScope(
    { orgId: session.orgId, actorType: "system" },
    async (tx) => {
      await tx
        .update(workOrders)
        // LIF-005: reopening clears the stale completedAt so the WO is not both
        // "completed" and "in progress".
        .set({ status: "in_progress", completedAt: null, updatedAt: new Date() })
        .where(eq(workOrders.id, parsed.workOrderId));
      await tx.insert(comments).values({
        orgId: session.orgId,
        targetType: "work_order",
        targetId: parsed.workOrderId,
        body: parsed.note,
        actorType: "tenant",
        actorUserId: session.tenantUserId,
        visibility: "external",
      });
      await writeAudit(tx, {
        orgId: session.orgId,
        targetType: "work_order",
        targetId: parsed.workOrderId,
        action: "tenant_reopened",
        actorType: "tenant",
        diff: { from: { status: "resolved" }, to: { status: "in_progress" }, reason: "tenant_not_fixed" },
      });
      return coveringTech(tx, wo.propertyId);
    },
  );

  if (tech) {
    await emitNotification({
      orgId: session.orgId,
      recipientUserId: tech.id,
      recipientEmail: tech.email ?? undefined,
      recipientPhone: tech.phone ?? undefined,
      kind: "wo_reopened",
      subject: `Resident reopened WO-${wo.number} — not fixed`,
      body: `The resident says ${wo.title} isn't resolved. Reopened to in progress.`,
      targetType: "work_order",
      targetId: parsed.workOrderId,
      url: `/tech/WO-${wo.number}`,
      actor: { type: "system" },
    });
  }
  return wo;
}

/* -------------------- push subscription -------------------- */

/** Register a resident's web-push subscription (RLS: own rows only). */
export async function subscribeTenantPush(
  session: TenantSession,
  sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
) {
  return withTenantScope(session, async (tx) => {
    await saveTenantPushSubscription(tx, {
      orgId: session.orgId,
      tenantUserId: session.tenantUserId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent ?? null,
    });
  });
}

/** Drop a resident's push subscription by endpoint (sign-out on this device). */
export async function unsubscribeTenantPush(session: TenantSession, endpoint: string) {
  return withTenantScope(session, async (tx) => {
    const [row] = await tx
      .select({ id: tenantPushSubscriptions.id })
      .from(tenantPushSubscriptions)
      .where(
        and(
          eq(tenantPushSubscriptions.orgId, session.orgId),
          eq(tenantPushSubscriptions.endpoint, endpoint),
        ),
      )
      .limit(1);
    if (row) await pruneTenantPushSubscription(tx, row.id);
  });
}

/** Register a resident's native (APNs) device token from the iOS app. */
export async function registerTenantDeviceToken(
  session: TenantSession,
  input: { token: string; platform?: string; userAgent?: string | null },
) {
  return withTenantScope(session, async (tx) => {
    await saveTenantDeviceToken(tx, {
      orgId: session.orgId,
      tenantUserId: session.tenantUserId,
      token: input.token,
      platform: input.platform ?? "ios",
      userAgent: input.userAgent ?? null,
    });
  });
}

/** Drop a resident's device token (sign-out / uninstall on this device). */
export async function unregisterTenantDeviceToken(session: TenantSession, token: string) {
  return withTenantScope(session, async (tx) => {
    const [row] = await tx
      .select({ id: tenantDeviceTokens.id })
      .from(tenantDeviceTokens)
      .where(and(eq(tenantDeviceTokens.orgId, session.orgId), eq(tenantDeviceTokens.token, token)))
      .limit(1);
    if (row) await pruneTenantDeviceToken(tx, row.id);
  });
}
