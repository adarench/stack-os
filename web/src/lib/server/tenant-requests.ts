import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { withTenantScope, withScope } from "./db";
import { workOrders } from "@db/schema/work-orders";
import { attachments } from "@db/schema/attachments";
import { auditLog } from "@db/schema/audit-log";
import { tenantUsers } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import type { TenantSession } from "./tenant-auth";
import { tenantStatusLabel, tenantStatusNeedsAction } from "@/lib/labels";
import { workOrderCategoryLabel } from "@contracts/work-order-category";
import { parseWoNumber } from "./work-orders";
import { signReadUrl, storageConfigured } from "./storage";

export interface TenantHeader {
  name: string | null;
  email: string | null;
  unitId: string | null;
  unitLabel: string | null;
  propertyName: string | null;
}

export interface TenantRequest {
  id: string;
  ref: string; // WO-123
  title: string;
  status: string; // internal status (for tone/logic)
  tenantStatus: string; // plain-language label
  needsAction: boolean;
  createdAt: string;
  updatedAt: string;
  isOpen: boolean;
}

const OPEN_STATUSES = new Set([
  "new",
  "triaged",
  "assigned",
  "scheduled",
  "in_progress",
  "blocked",
  "resolved",
]);

/** The resident's unit/property header — scoped, RLS-enforced to their row. */
export async function loadTenantHeader(session: TenantSession): Promise<TenantHeader | null> {
  return withTenantScope(session, async (tx) => {
    const [me] = await tx
      .select({
        name: tenantUsers.name,
        email: tenantUsers.email,
        unitId: tenantUsers.unitId,
        unitLabel: units.label,
        propertyName: properties.name,
      })
      .from(tenantUsers)
      .leftJoin(units, eq(units.id, tenantUsers.unitId))
      .leftJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(tenantUsers.id, session.tenantUserId))
      .limit(1);
    return me ?? null;
  });
}

/** Every work order on the resident's unit, newest first. RLS double-guards. */
export async function loadTenantRequests(session: TenantSession): Promise<TenantRequest[]> {
  return withTenantScope(session, async (tx) => {
    const [me] = await tx
      .select({ unitId: tenantUsers.unitId })
      .from(tenantUsers)
      .where(eq(tenantUsers.id, session.tenantUserId))
      .limit(1);
    if (!me?.unitId) return [];

    const rows = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.unitId, me.unitId)))
      .orderBy(desc(workOrders.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      ref: `WO-${r.number}`,
      title: r.title,
      status: r.status,
      tenantStatus: tenantStatusLabel(r.status),
      needsAction: tenantStatusNeedsAction(r.status),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      isOpen: OPEN_STATUSES.has(r.status),
    }));
  });
}

export interface TenantPhoto {
  id: string;
  url: string;
  isVideo: boolean;
}

export interface TenantTimelineEvent {
  id: string;
  label: string;
  at: string;
}

export interface TenantRequestDetail {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  category: string | null; // humanized label
  status: string;
  tenantStatus: string;
  needsAction: boolean;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  photos: TenantPhoto[];
  timeline: TenantTimelineEvent[];
}

/**
 * Map a raw audit action to a tenant-safe milestone label, or null to hide it.
 * We deliberately surface only submission + status milestones — internal
 * events (vendor assignment, internal notes) never reach the resident.
 */
function tenantTimelineLabel(action: string, diff: unknown): string | null {
  if (action === "created" || action === "tenant_submitted") return "Request submitted";
  if (action === "tenant_reopened") return "You reported it’s not fixed";
  if (action === "status_changed") {
    const to = (diff as { to?: { status?: string } } | null)?.to?.status;
    return to ? tenantStatusLabel(to) : null;
  }
  return null;
}

/** Full detail for one of the resident's requests (own-unit, RLS-guarded). */
export async function loadTenantRequest(
  session: TenantSession,
  ref: string,
): Promise<TenantRequestDetail | null> {
  const number = parseWoNumber(ref);
  if (number === null) return null;

  // WO + its attachments — both under tenant RLS (own-unit only).
  const data = await withTenantScope(session, async (tx) => {
    const [wo] = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        description: workOrders.description,
        category: workOrders.category,
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, session.orgId), eq(workOrders.number, number)))
      .limit(1);
    if (!wo) return null;
    const atts = await tx
      .select({
        id: attachments.id,
        storageKey: attachments.storageKey,
        contentType: attachments.contentType,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.orgId, session.orgId),
          eq(attachments.targetType, "work_order"),
          eq(attachments.targetId, wo.id),
        ),
      )
      .orderBy(asc(attachments.createdAt));
    return { wo, atts };
  });
  if (!data) return null;

  // Timeline — read audit under system scope (tenants can't read audit_log),
  // having already validated ownership via the tenant-scoped WO read above.
  const events = await withScope(
    { orgId: session.orgId, actorType: "system" },
    async (tx) =>
      tx
        .select({ id: auditLog.id, action: auditLog.action, diff: auditLog.diff, createdAt: auditLog.createdAt })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.orgId, session.orgId),
            eq(auditLog.targetType, "work_order"),
            eq(auditLog.targetId, data.wo.id),
          ),
        )
        .orderBy(asc(auditLog.createdAt)),
  );

  const timeline: TenantTimelineEvent[] = [];
  let last: string | null = null;
  for (const e of events) {
    const label = tenantTimelineLabel(e.action, e.diff);
    if (!label || label === last) continue;
    timeline.push({ id: e.id, label, at: e.createdAt.toISOString() });
    last = label;
  }

  const photos: TenantPhoto[] = storageConfigured()
    ? await Promise.all(
        data.atts.map(async (a) => ({
          id: a.id,
          url: await signReadUrl(a.storageKey),
          isVideo: (a.contentType ?? "").startsWith("video"),
        })),
      )
    : [];

  const wo = data.wo;
  return {
    id: wo.id,
    ref: `WO-${wo.number}`,
    title: wo.title,
    description: wo.description,
    category: workOrderCategoryLabel(wo.category),
    status: wo.status,
    tenantStatus: tenantStatusLabel(wo.status),
    needsAction: tenantStatusNeedsAction(wo.status),
    isOpen: OPEN_STATUSES.has(wo.status),
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
    photos,
    timeline,
  };
}
