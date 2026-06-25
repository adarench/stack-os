import "server-only";
import { and, asc, desc, eq, inArray, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { tenantUsers } from "@db/schema/compliance";
import { users } from "@db/schema/users";
import { withStaffScope } from "./db";

const OPEN_STATUSES = ["new", "triaged", "assigned", "scheduled", "in_progress", "blocked"] as const;

/** Properties index — name, covering tech, and open work-order count each. */
export async function loadPropertiesIndex() {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: properties.id,
        name: properties.name,
        city: properties.city,
        state: properties.state,
        techName: users.name,
      })
      .from(properties)
      .leftJoin(users, eq(users.id, properties.defaultAssigneeUserId))
      .where(eq(properties.orgId, ctx.orgId))
      .orderBy(asc(properties.name));

    const counts = await tx
      .select({
        propertyId: workOrders.propertyId,
        n: drizzleSql<number>`count(*)::int`,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, ctx.orgId),
          inArray(workOrders.status, [...OPEN_STATUSES]),
        ),
      )
      .groupBy(workOrders.propertyId);
    const open = new Map(counts.map((c) => [c.propertyId, c.n]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      location: [r.city, r.state].filter(Boolean).join(", "),
      techName: r.techName,
      openCount: open.get(r.id) ?? 0,
    }));
  });
}

/** A property + its units, each with the current tenant and open count. */
export async function loadPropertyDetail(propertyId: string) {
  return withStaffScope(async (tx, ctx) => {
    const prop = (
      await tx
        .select({
          id: properties.id,
          name: properties.name,
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state,
        })
        .from(properties)
        .where(and(eq(properties.orgId, ctx.orgId), eq(properties.id, propertyId)))
        .limit(1)
    )[0];
    if (!prop) return null;

    const unitRows = await tx
      .select({ id: units.id, label: units.label })
      .from(units)
      .where(and(eq(units.orgId, ctx.orgId), eq(units.propertyId, propertyId)))
      .orderBy(asc(units.label));
    const unitIds = unitRows.map((u) => u.id);

    const tenants = unitIds.length
      ? await tx
          .select({ unitId: tenantUsers.unitId, name: tenantUsers.name })
          .from(tenantUsers)
          .where(
            and(
              eq(tenantUsers.orgId, ctx.orgId),
              eq(tenantUsers.status, "active"),
              inArray(tenantUsers.unitId, unitIds),
            ),
          )
      : [];
    const tenantByUnit = new Map(tenants.map((t) => [t.unitId, t.name]));

    const openCounts = unitIds.length
      ? await tx
          .select({
            unitId: workOrders.unitId,
            n: drizzleSql<number>`count(*)::int`,
          })
          .from(workOrders)
          .where(
            and(
              eq(workOrders.orgId, ctx.orgId),
              inArray(workOrders.status, [...OPEN_STATUSES]),
              inArray(workOrders.unitId, unitIds),
            ),
          )
          .groupBy(workOrders.unitId)
      : [];
    const openByUnit = new Map(openCounts.map((c) => [c.unitId, c.n]));

    return {
      property: prop,
      units: unitRows.map((u) => ({
        id: u.id,
        label: u.label,
        tenantName: tenantByUnit.get(u.id) ?? null,
        openCount: openByUnit.get(u.id) ?? 0,
      })),
    };
  });
}

/** Full dated work-order log for one unit — the "what did we do for tenant X"
 *  report. Includes the current tenant and the unit/property header. */
export async function loadUnitWorkOrders(unitId: string) {
  return withStaffScope(async (tx, ctx) => {
    const head = (
      await tx
        .select({
          unitId: units.id,
          unitLabel: units.label,
          propertyId: properties.id,
          propertyName: properties.name,
        })
        .from(units)
        .leftJoin(properties, eq(properties.id, units.propertyId))
        .where(and(eq(units.orgId, ctx.orgId), eq(units.id, unitId)))
        .limit(1)
    )[0];
    if (!head) return null;

    const tenant = (
      await tx
        .select({ name: tenantUsers.name, email: tenantUsers.email })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.orgId, ctx.orgId),
            eq(tenantUsers.unitId, unitId),
            eq(tenantUsers.status, "active"),
          ),
        )
        .orderBy(desc(tenantUsers.createdAt))
        .limit(1)
    )[0] ?? null;

    const wos = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        status: workOrders.status,
        priority: workOrders.priority,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.unitId, unitId)))
      .orderBy(desc(workOrders.createdAt));

    return {
      unit: head,
      tenant,
      workOrders: wos.map((w) => ({
        id: w.id,
        ref: `WO-${w.number}`,
        title: w.title,
        status: w.status,
        priority: w.priority,
        createdAt: w.createdAt.toISOString(),
        completedAt: w.completedAt ? w.completedAt.toISOString() : null,
      })),
    };
  });
}
