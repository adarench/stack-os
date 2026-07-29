/**
 * Onboarding — force-change-on-first-login (temp password → user sets their own).
 * Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import postgres from "postgres";
import { staffMustChangePassword, setOwnStaffPassword, setStaffPassword, verifyStaffCredentials } from "@/lib/server/credentials";
import { tenantMustChangePassword, setOwnTenantPassword, setTenantPassword, verifyTenantCredentials } from "@/lib/server/tenant-credentials";

const ORG = `org_onbd_${Date.now()}`;
const SUBJECT = `local:onbd_${Date.now()}`;
const S_EMAIL = `op_${Date.now()}@stackwithus.com`;
const T_EMAIL = `res_${Date.now()}@lucid.test`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { staffId: "", unitId: "", propertyId: "", tenantId: "" };

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
    const [s] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role, must_change_password) values (${ORG}, ${SUBJECT}, ${S_EMAIL}, ${"Op"}, 'admin', true) returning id`;
    ids.staffId = s!.id;
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"B"}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"S1"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status, must_change_password) values (${ORG}, ${ids.unitId}, ${T_EMAIL}, ${"R"}, 'active', true) returning id`;
    ids.tenantId = t!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("onboarding force-change", () => {
  it("staff: flag is set, self-set clears it and the new password works", async () => {
    await setStaffPassword(ORG, ids.staffId, "Temp-Start-99");
    expect(await staffMustChangePassword(ORG, SUBJECT)).toBe(true); // still forced
    await setOwnStaffPassword(ORG, SUBJECT, "MyReal-Pass-99");
    expect(await staffMustChangePassword(ORG, SUBJECT)).toBe(false); // cleared
    expect(await verifyStaffCredentials(ORG, S_EMAIL, "MyReal-Pass-99")).not.toBeNull();
  }, 30_000);

  it("tenant: flag is set, self-set clears it and the new password works", async () => {
    await setTenantPassword(ORG, ids.tenantId, "Temp-Start-99");
    const session = { orgId: ORG, tenantUserId: ids.tenantId };
    expect(await tenantMustChangePassword(session)).toBe(true);
    await setOwnTenantPassword(session, "MyReal-Pass-99");
    expect(await tenantMustChangePassword(session)).toBe(false);
    expect(await verifyTenantCredentials(null, T_EMAIL, "MyReal-Pass-99")).not.toBeNull();
  }, 30_000);
});
