import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { tenantCompanies, orgSettings } from "@db/schema/commercial";
import { tenantUsers } from "@db/schema/compliance";
import { withStaffScope } from "./db";

/**
 * Commercial model config (M3 · LOC-004/005, ADM-002/003). Operator-scoped.
 * Routing consumption (the org fallback assignee) lives in the tenant/staff
 * work-order create paths; this module is the admin-side read/write surface.
 */

export async function listTenantCompanies() {
  return withStaffScope((tx, ctx) =>
    tx
      .select()
      .from(tenantCompanies)
      .where(eq(tenantCompanies.orgId, ctx.orgId))
      .orderBy(asc(tenantCompanies.name)),
  );
}

export async function createTenantCompany(name: string) {
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("company_name_required");
  return withStaffScope(async (tx, ctx) => {
    const [row] = await tx
      .insert(tenantCompanies)
      .values({ orgId: ctx.orgId, name: clean })
      .returning();
    return row!;
  });
}

/** Assign (or clear) a resident's occupying company. */
export async function assignTenantToCompany(tenantUserId: string, companyId: string | null) {
  return withStaffScope((tx, ctx) =>
    tx
      .update(tenantUsers)
      .set({ companyId })
      .where(and(eq(tenantUsers.orgId, ctx.orgId), eq(tenantUsers.id, tenantUserId))),
  );
}

/** Org-level fallback assignee (ASN-003) — used when no building tech is set. */
export async function getOrgFallbackAssignee(): Promise<string | null> {
  return withStaffScope(async (tx, ctx) => {
    const [s] = await tx
      .select({ fb: orgSettings.fallbackAssigneeUserId })
      .from(orgSettings)
      .where(eq(orgSettings.orgId, ctx.orgId))
      .limit(1);
    return s?.fb ?? null;
  });
}

export async function setOrgFallbackAssignee(userId: string | null) {
  return withStaffScope(async (tx, ctx) => {
    const [existing] = await tx
      .select({ id: orgSettings.id })
      .from(orgSettings)
      .where(eq(orgSettings.orgId, ctx.orgId))
      .limit(1);
    if (existing) {
      await tx
        .update(orgSettings)
        .set({ fallbackAssigneeUserId: userId, updatedAt: new Date() })
        .where(eq(orgSettings.id, existing.id));
    } else {
      await tx.insert(orgSettings).values({ orgId: ctx.orgId, fallbackAssigneeUserId: userId });
    }
  });
}
