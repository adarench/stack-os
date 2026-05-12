import "server-only";
import { and, asc, desc, eq, isNull, lte, ne, sql as drizzleSql } from "drizzle-orm";
import { vendorCois, tenantInsurancePolicies, tenantUsers } from "@db/schema/compliance";
import { vendors } from "@db/schema/vendors";
import { units } from "@db/schema/units";
import { withStaffScope, type ScopedDB } from "./db";
import type { ComplianceStatus } from "@contracts/compliance";

export interface CoiRow {
  id: string;
  vendorId: string;
  vendorName: string;
  policyNumber: string | null;
  carrier: string | null;
  expiresAt: string | null;
  status: ComplianceStatus;
  updatedAt: string;
}

export interface TenantInsRow {
  id: string;
  tenantUserId: string;
  tenantName: string | null;
  tenantEmail: string;
  unitLabel: string | null;
  carrier: string | null;
  expiresAt: string | null;
  status: ComplianceStatus;
  updatedAt: string;
}

export interface AssignGateViolation {
  vendorId: string;
  vendorName: string;
}

export interface ComplianceView {
  cois: CoiRow[];
  tenantIns: TenantInsRow[];
  violations: AssignGateViolation[];
  summary: {
    coiActive: number;
    coiExpiring: number;
    coiExpired: number;
    tenantActive: number;
    tenantExpiring: number;
    tenantExpired: number;
    gateViolations: number;
  };
}

export async function loadComplianceView(): Promise<ComplianceView> {
  return withStaffScope(async (tx, ctx) => {
    const orgId = ctx.orgId;
    const [cois, tenantIns, violations, summary] = await Promise.all([
      loadCois(tx, orgId),
      loadTenantIns(tx, orgId),
      loadAssignGateViolations(tx, orgId),
      loadSummary(tx, orgId),
    ]);
    return { cois, tenantIns, violations, summary };
  });
}

async function loadCois(tx: ScopedDB, orgId: string): Promise<CoiRow[]> {
  const rows = await tx
    .select({
      id: vendorCois.id,
      vendorId: vendorCois.vendorId,
      vendorName: vendors.name,
      policyNumber: vendorCois.policyNumber,
      carrier: vendorCois.carrier,
      expiresAt: vendorCois.expiresAt,
      status: vendorCois.status,
      updatedAt: vendorCois.updatedAt,
    })
    .from(vendorCois)
    .leftJoin(vendors, eq(vendors.id, vendorCois.vendorId))
    .where(
      and(
        eq(vendorCois.orgId, orgId),
        ne(vendorCois.status, "superseded"),
      ),
    )
    .orderBy(asc(vendorCois.expiresAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    vendorId: r.vendorId,
    vendorName: r.vendorName ?? "(unknown)",
    policyNumber: r.policyNumber,
    carrier: r.carrier,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

async function loadTenantIns(
  tx: ScopedDB,
  orgId: string,
): Promise<TenantInsRow[]> {
  const rows = await tx
    .select({
      id: tenantInsurancePolicies.id,
      tenantUserId: tenantInsurancePolicies.tenantUserId,
      tenantName: tenantUsers.name,
      tenantEmail: tenantUsers.email,
      unitLabel: units.label,
      carrier: tenantInsurancePolicies.carrier,
      expiresAt: tenantInsurancePolicies.expiresAt,
      status: tenantInsurancePolicies.status,
      updatedAt: tenantInsurancePolicies.updatedAt,
    })
    .from(tenantInsurancePolicies)
    .leftJoin(
      tenantUsers,
      eq(tenantUsers.id, tenantInsurancePolicies.tenantUserId),
    )
    .leftJoin(units, eq(units.id, tenantInsurancePolicies.unitId))
    .where(
      and(
        eq(tenantInsurancePolicies.orgId, orgId),
        ne(tenantInsurancePolicies.status, "superseded"),
      ),
    )
    .orderBy(asc(tenantInsurancePolicies.expiresAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    tenantUserId: r.tenantUserId,
    tenantName: r.tenantName,
    tenantEmail: r.tenantEmail ?? "(unknown)",
    unitLabel: r.unitLabel,
    carrier: r.carrier,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

async function loadAssignGateViolations(
  tx: ScopedDB,
  orgId: string,
): Promise<AssignGateViolation[]> {
  // Vendors active in org but with no active/expiring COI. LEFT JOIN +
  // GROUP BY HAVING avoids correlated NOT EXISTS so we stay inside Drizzle's
  // typed query builder.
  const rows = await tx
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .leftJoin(
      vendorCois,
      and(
        eq(vendorCois.vendorId, vendors.id),
        eq(vendorCois.orgId, orgId),
        drizzleSql`${vendorCois.status} IN ('active', 'expiring')`,
      ),
    )
    .where(and(eq(vendors.orgId, orgId), eq(vendors.status, "active")))
    .groupBy(vendors.id, vendors.name)
    .having(drizzleSql`count(${vendorCois.id}) = 0`)
    .orderBy(asc(vendors.name))
    .limit(100);
  return rows.map((r) => ({ vendorId: r.id, vendorName: r.name }));
}

async function loadSummary(tx: ScopedDB, orgId: string) {
  // GROUP BY status counts for both tables in one query each.
  const coiByStatus = await tx
    .select({
      status: vendorCois.status,
      n: drizzleSql<string>`count(*)::text`,
    })
    .from(vendorCois)
    .where(eq(vendorCois.orgId, orgId))
    .groupBy(vendorCois.status);
  const tenantByStatus = await tx
    .select({
      status: tenantInsurancePolicies.status,
      n: drizzleSql<string>`count(*)::text`,
    })
    .from(tenantInsurancePolicies)
    .where(eq(tenantInsurancePolicies.orgId, orgId))
    .groupBy(tenantInsurancePolicies.status);

  const pick = (rows: Array<{ status: string; n: string }>, s: string) =>
    Number(rows.find((r) => r.status === s)?.n ?? 0);

  const violationRows = await tx
    .select({ n: drizzleSql<string>`count(*)::text` })
    .from(vendors)
    .leftJoin(
      vendorCois,
      and(
        eq(vendorCois.vendorId, vendors.id),
        eq(vendorCois.orgId, orgId),
        drizzleSql`${vendorCois.status} IN ('active', 'expiring')`,
      ),
    )
    .where(and(eq(vendors.orgId, orgId), eq(vendors.status, "active")))
    .having(drizzleSql`count(${vendorCois.id}) = 0`)
    .groupBy(vendors.id);

  return {
    coiActive: pick(coiByStatus, "active"),
    coiExpiring: pick(coiByStatus, "expiring"),
    coiExpired: pick(coiByStatus, "expired"),
    tenantActive: pick(tenantByStatus, "active"),
    tenantExpiring: pick(tenantByStatus, "expiring"),
    tenantExpired: pick(tenantByStatus, "expired"),
    gateViolations: violationRows.length,
  };
}
