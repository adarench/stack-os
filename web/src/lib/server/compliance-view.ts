import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql as drizzleSql } from "drizzle-orm";
import { vendorCois, tenantInsurancePolicies, tenantUsers } from "@db/schema/compliance";
import { vendors } from "@db/schema/vendors";
import { units } from "@db/schema/units";
import { assignments } from "@db/schema/assignments";
import { vendorUsers } from "@db/schema/vendor-users";
import { workOrders } from "@db/schema/work-orders";
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
  /** Open WOs currently assigned to this vendor. Non-zero on expired rows
   *  is the operational consequence chip the row carries. */
  affectedOpenWoCount: number;
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

export interface BlockedWoRef {
  ref: string;
  title: string;
}

export interface AssignGateViolation {
  vendorId: string;
  vendorName: string;
  /** Open WOs currently assigned to this vendor. The decision-pressure number:
   *  "no COI · blocks 3 active WOs" reads sharper than the violation alone. */
  blockedOpenWoCount: number;
  /** Up to 5 of those WOs — rendered when the operator expands the chip. */
  blockedWoRefs: BlockedWoRef[];
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

/**
 * A compliance blocker as it appears on the /now command view: a vendor that
 * can't be dispatched (no/expired COI) or is about to lapse — with the open
 * work it puts at risk. Pure derivation from ComplianceView so it's testable.
 */
export interface ComplianceBlocker {
  key: string;
  vendorName: string;
  reason: "no COI" | "COI expired" | "COI expiring";
  /** "expired 3d ago" / "in 8d" — null when no expiry on file. */
  detail: string | null;
  /** Open WOs this vendor is holding (the "what breaks" number). */
  blockedCount: number;
  /** Up to 5 of those WO refs, when known (violations carry them). */
  blockedWoRefs: BlockedWoRef[];
  tone: "alert" | "warn";
}

const DAY_MS = 86_400_000;

/**
 * Morning-triage blockers, worst-first: vendors who can't be dispatched
 * (alert) above vendors expiring soon (warn). A vendor with an expired COI
 * row is shown as "COI expired" (with a date), not the generic "no COI".
 */
export function selectComplianceBlockers(
  view: ComplianceView,
  now: Date,
): ComplianceBlocker[] {
  const out: ComplianceBlocker[] = [];
  const expiredVendorIds = new Set(
    view.cois.filter((c) => c.status === "expired").map((c) => c.vendorId),
  );

  // Assign-gate violations — but only the truly COI-less ones; vendors whose
  // COI lapsed are surfaced (with a date) by the expired branch below.
  for (const v of view.violations) {
    if (expiredVendorIds.has(v.vendorId)) continue;
    out.push({
      key: `viol-${v.vendorId}`,
      vendorName: v.vendorName,
      reason: "no COI",
      detail: null,
      blockedCount: v.blockedOpenWoCount,
      blockedWoRefs: v.blockedWoRefs,
      tone: "alert",
    });
  }
  for (const c of view.cois) {
    if (c.status === "expired") {
      out.push({
        key: `coi-${c.id}`,
        vendorName: c.vendorName,
        reason: "COI expired",
        detail: c.expiresAt ? expiryDetail(c.expiresAt, now) : null,
        blockedCount: c.affectedOpenWoCount,
        blockedWoRefs: [],
        tone: "alert",
      });
    } else if (c.status === "expiring") {
      out.push({
        key: `coi-${c.id}`,
        vendorName: c.vendorName,
        reason: "COI expiring",
        detail: c.expiresAt ? expiryDetail(c.expiresAt, now) : null,
        blockedCount: c.affectedOpenWoCount,
        blockedWoRefs: [],
        tone: "warn",
      });
    }
  }

  out.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === "alert" ? -1 : 1;
    return b.blockedCount - a.blockedCount;
  });
  return out;
}

function expiryDetail(iso: string, now: Date): string {
  const days = Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return `expired ${-days}d ago`;
  if (days === 0) return "expires today";
  return `in ${days}d`;
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

  const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId)));
  const affectedByVendor = await loadOpenWoCountsByVendor(tx, orgId, vendorIds);

  return rows.map((r) => ({
    id: r.id,
    vendorId: r.vendorId,
    vendorName: r.vendorName ?? "(unknown)",
    policyNumber: r.policyNumber,
    carrier: r.carrier,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    affectedOpenWoCount: affectedByVendor.get(r.vendorId) ?? 0,
  }));
}

/**
 * For each vendor id, count currently-active assignments to open work
 * orders. The dispatcher's "what would break" number — surfaced next to a
 * lapsed COI or assign-gate violation as the consequence chip.
 *
 * Single query with GROUP BY; if vendorIds is empty, no roundtrip.
 */
async function loadOpenWoCountsByVendor(
  tx: ScopedDB,
  orgId: string,
  vendorIds: string[],
): Promise<Map<string, number>> {
  if (vendorIds.length === 0) return new Map();
  // Count open WOs either directly assigned to the vendor OR assigned
  // to a vendor_user whose parent vendor is in our list. Both count as
  // "this vendor is holding this work" from a dispatch POV.
  const rows = await tx
    .select({
      vendorId: drizzleSql<string>`CASE WHEN ${assignments.assigneeType} = 'vendor' THEN ${assignments.assigneeId} ELSE ${vendorUsers.vendorId} END`,
      n: drizzleSql<string>`count(distinct ${assignments.targetId})::text`,
    })
    .from(assignments)
    .leftJoin(workOrders, eq(workOrders.id, assignments.targetId))
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        or(
          and(
            eq(assignments.assigneeType, "vendor"),
            inArray(assignments.assigneeId, vendorIds),
          ),
          and(
            eq(assignments.assigneeType, "vendor_user"),
            inArray(vendorUsers.vendorId, vendorIds),
          ),
        ),
        isNull(assignments.unassignedAt),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'resolved', 'verified')`,
      ),
    )
    .groupBy(drizzleSql`1`);
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.vendorId) out.set(r.vendorId, Number(r.n));
  }
  return out;
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

  const [counts, refs] = await Promise.all([
    loadOpenWoCountsByVendor(tx, orgId, rows.map((r) => r.id)),
    loadBlockedWoRefsByVendor(tx, orgId, rows.map((r) => r.id)),
  ]);

  return rows.map((r) => ({
    vendorId: r.id,
    vendorName: r.name,
    blockedOpenWoCount: counts.get(r.id) ?? 0,
    blockedWoRefs: refs.get(r.id) ?? [],
  }));
}

/**
 * Up to 5 open WOs per vendor — surfaced inline when the operator
 * expands a "blocks N WOs" chip. Operators see the actual at-risk
 * work in one click instead of having to filter /work.
 */
async function loadBlockedWoRefsByVendor(
  tx: ScopedDB,
  orgId: string,
  vendorIds: string[],
): Promise<Map<string, BlockedWoRef[]>> {
  if (vendorIds.length === 0) return new Map();
  // Mirror loadOpenWoCountsByVendor — resolve both direct vendor and
  // vendor_user assignments so the count matches the listed refs.
  const rows = await tx
    .select({
      vendorId: drizzleSql<string>`CASE WHEN ${assignments.assigneeType} = 'vendor' THEN ${assignments.assigneeId} ELSE ${vendorUsers.vendorId} END`,
      number: workOrders.number,
      title: workOrders.title,
      updatedAt: workOrders.updatedAt,
    })
    .from(assignments)
    .innerJoin(workOrders, eq(workOrders.id, assignments.targetId))
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        or(
          and(
            eq(assignments.assigneeType, "vendor"),
            inArray(assignments.assigneeId, vendorIds),
          ),
          and(
            eq(assignments.assigneeType, "vendor_user"),
            inArray(vendorUsers.vendorId, vendorIds),
          ),
        ),
        isNull(assignments.unassignedAt),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'resolved', 'verified')`,
      ),
    )
    .orderBy(desc(workOrders.updatedAt));

  const out = new Map<string, BlockedWoRef[]>();
  for (const r of rows) {
    if (!r.vendorId) continue;
    const list = out.get(r.vendorId) ?? [];
    if (list.length < 5) {
      list.push({ ref: `WO-${r.number}`, title: r.title });
      out.set(r.vendorId, list);
    }
  }
  return out;
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
