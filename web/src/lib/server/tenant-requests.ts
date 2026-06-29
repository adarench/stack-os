import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { withTenantScope } from "./db";
import { workOrders } from "@db/schema/work-orders";
import { tenantUsers } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import type { TenantSession } from "./tenant-auth";
import { tenantStatusLabel, tenantStatusNeedsAction } from "@/lib/labels";

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
