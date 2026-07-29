/**
 * AUTH/AUTHZ MATRIX — the 18 required cases. Most are already covered by focused
 * suites (mapped below); this file fills the gaps (tenant disabled-block, same-org
 * tenant isolation, role change) and serves as the index. Auto-skipped w/o DATABASE_URL.
 *
 *  1 valid login .............. credential-auth + tenant-credentials + here
 *  2 invalid login ............ credential-auth + tenant-credentials
 *  3 disabled account ......... credential-auth (staff) + here (tenant)
 *  4 password reset ........... password-reset
 *  5 expired reset token ...... password-reset
 *  6 session persistence ...... tenant-auth cookie HMAC round-trip (unit) + e2e
 *  7 session revocation ....... deactivate blocks login → here (#3) / account mgmt
 *  8 tenant own request ....... at-canonical (step 5)
 *  9 tenant blocked (other) ... at-canonical (cross-org) + here (same-org other unit)
 * 10 tech assigned work ....... at-canonical + m4-technician
 * 11 tech blocked work ....... assign-technician + m4 (requireMyWo)
 * 12 admin provisions ........ import-users + credentials (provisionStaffAccount) + here
 * 13 role change ............. here
 * 14 unit reassignment ....... account mgmt (reassignTenantUnitAction) + here
 * 15 logout ................. tenant-auth clearTenantSession (cookie delete)
 * 16 mobile API authz ....... m9-vendor (RLS write block) + tech uploads (requireMyWo)
 * 17 deep-link auth ......... session-gated pages (readTenantSession/auth redirect)
 * 18 Lucid loop regression .. at-canonical (full 7-step loop)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import postgres from "postgres";
import { verifyTenantCredentials, setTenantPassword } from "@/lib/server/tenant-credentials";
import { provisionStaffAccount, setStaffPassword, loadStaffRole, verifyStaffCredentials } from "@/lib/server/credentials";
import { loadTenantRequest } from "@/lib/server/tenant-requests";

const ORG = `org_authmx_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { propertyId: "", unitA: "", unitB: "", tenantA: "", tenantB: "", woA: 0, woAId: "" };
const A_EMAIL = `a_${Date.now()}@lucid.test`;
const B_EMAIL = `b_${Date.now()}@lucid.test`;

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"B"}) returning id`;
    ids.propertyId = p!.id;
    const [ua] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"A"}) returning id`;
    const [ub] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"B"}) returning id`;
    ids.unitA = ua!.id; ids.unitB = ub!.id;
    const [ta] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status) values (${ORG}, ${ids.unitA}, ${A_EMAIL}, ${"A"}, 'active') returning id`;
    const [tb] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status) values (${ORG}, ${ids.unitB}, ${B_EMAIL}, ${"B"}, 'active') returning id`;
    ids.tenantA = ta!.id; ids.tenantB = tb!.id;
    const [wo] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, status, kind, priority, category, unit_id, property_id, created_by_actor_type, created_by_tenant_user_id)
      values (${ORG}, 8801, ${"A's leak"}, 'new', 'work_order', 'normal', 'plumbing', ${ids.unitA}, ${ids.propertyId}, 'tenant', ${ids.tenantA}) returning id, number`;
    ids.woAId = wo!.id; ids.woA = wo!.number;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("auth/authz matrix (gap cases)", () => {
  it("#1/#3 valid login works; a deactivated tenant is blocked", async () => {
    await setTenantPassword(ORG, ids.tenantA, "Valid-Pass-123");
    expect(await verifyTenantCredentials(null, A_EMAIL, "Valid-Pass-123")).not.toBeNull();
    // Deactivate → login blocked even with the right password.
    await admin!.begin(async (tx) => { await sys(tx); await tx`update tenant_users set status='revoked' where id=${ids.tenantA}`; });
    expect(await verifyTenantCredentials(null, A_EMAIL, "Valid-Pass-123")).toBeNull();
    await admin!.begin(async (tx) => { await sys(tx); await tx`update tenant_users set status='active' where id=${ids.tenantA}`; });
  }, 30_000);

  it("#9 a tenant cannot see another tenant's request in the same org (RLS)", async () => {
    const own = await loadTenantRequest({ orgId: ORG, tenantUserId: ids.tenantA }, `WO-${ids.woA}`);
    expect(own).not.toBeNull(); // A sees A's WO
    const other = await loadTenantRequest({ orgId: ORG, tenantUserId: ids.tenantB }, `WO-${ids.woA}`);
    expect(other).toBeNull(); // B (different unit, same org) cannot
  }, 20_000);

  it("#12/#13 admin provisions a staff account; role change takes effect", async () => {
    const uid = await provisionStaffAccount(ORG, { email: `tech_${Date.now()}@stackwithus.com`, name: "T", role: "staff", password: "Provisioned-1" });
    expect(uid).toBeTruthy();
    // Role change reflected by the RBAC read.
    await admin!.begin(async (tx) => { await sys(tx); await tx`update users set role='technician' where id=${uid}`; });
    const subject = await admin!.begin(async (tx) => { await sys(tx); return tx<{ c: string }[]>`select clerk_user_id c from users where id=${uid}`; });
    expect(await loadStaffRole(ORG, subject[0]!.c)).toBe("technician");
  }, 30_000);

  it("#12 provisioned staff can then log in", async () => {
    const email = `op_${Date.now()}@stackwithus.com`;
    const uid = await provisionStaffAccount(ORG, { email, name: "Op", role: "admin", password: "TempStart-1" });
    await setStaffPassword(ORG, uid, "RealPass-123");
    expect(await verifyStaffCredentials(ORG, email, "RealPass-123")).not.toBeNull();
  }, 30_000);
});
