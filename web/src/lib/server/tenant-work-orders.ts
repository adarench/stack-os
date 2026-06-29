import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withTenantScope, withScope } from "./db";
import { workOrders } from "@db/schema/work-orders";
import { tenantUsers } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import { attachments } from "@db/schema/attachments";
import { users } from "@db/schema/users";
import { ATTACHMENT_KINDS } from "@contracts/polymorphic";
import { WORK_ORDER_CATEGORIES } from "@contracts/work-order-category";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";
import { nextWorkOrderNumber } from "./sequence";
import { writeAudit } from "./audit";
import { emitNotification } from "./notifications";
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
      const number = await nextWorkOrderNumber(tx, session.orgId);
      const [row] = await tx
        .insert(workOrders)
        .values({
          orgId: session.orgId,
          number,
          title: parsed.title,
          description: parsed.description ?? null,
          category: parsed.category,
          status: "new", // land in ops triage ("Not seen"); no auto-route
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
        diff: { to: { status: "new", title: parsed.title, category: parsed.category } },
      });

      let tech: { id: string; email: string | null; phone: string | null } | null = null;
      if (scope.coveringUserId) {
        const [u] = await tx
          .select({ id: users.id, email: users.email, phone: users.phone })
          .from(users)
          .where(and(eq(users.orgId, session.orgId), eq(users.id, scope.coveringUserId)))
          .limit(1);
        tech = u ?? null;
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
      actor: { type: "system" },
    });
  }

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
