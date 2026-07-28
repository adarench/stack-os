/**
 * Tenant credential auth (email + password) — "everybody at Lucid gets their
 * own login." Verifies set-password, correct/wrong login, generic null for a
 * missing account, and per-account lockout. Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import postgres from "postgres";
import { verifyTenantCredentials, setTenantPassword } from "@/lib/server/tenant-credentials";

const ORG = `org_tcred_${Date.now()}`;
const EMAIL = `sam_${Date.now()}@lucid.test`;
const PASSWORD = "Sam-Str0ng-Pass!";
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { unitId: "", propertyId: "", tenantId: "" };

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
    const [p] = await tx<{ id: string }[]>`
      insert into properties (org_id, name) values (${ORG}, ${"Lucid HQ"}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"Suite 300"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, name, status)
      values (${ORG}, ${ids.unitId}, ${EMAIL}, ${"Sam Lucid"}, 'invited') returning id`;
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
  });
  await admin.end();
});

describe.skipIf(skip)("tenant credential auth", () => {
  it("set-password activates the account and enables login", async () => {
    await setTenantPassword(ORG, ids.tenantId, PASSWORD);
    const ok = await verifyTenantCredentials(ORG, EMAIL, PASSWORD);
    expect(ok).not.toBeNull();
    expect(ok!.tenantUserId).toBe(ids.tenantId);
    expect(ok!.orgId).toBe(ORG);
    expect(ok!.email).toBe(EMAIL);
    // Email lookup is case-insensitive.
    const ci = await verifyTenantCredentials(ORG, EMAIL.toUpperCase(), PASSWORD);
    expect(ci).not.toBeNull();
  }, 30_000);

  it("wrong password returns null (no session)", async () => {
    const bad = await verifyTenantCredentials(ORG, EMAIL, "not-the-password");
    expect(bad).toBeNull();
  }, 20_000);

  it("a missing account returns null (no account-existence disclosure)", async () => {
    const nobody = await verifyTenantCredentials(ORG, "nobody@lucid.test", PASSWORD);
    expect(nobody).toBeNull();
  }, 20_000);

  it("locks the account after repeated failures, then blocks even the correct password", async () => {
    // Reset to a known state, then trip the lockout (5 failures).
    await setTenantPassword(ORG, ids.tenantId, PASSWORD);
    for (let i = 0; i < 5; i++) {
      await verifyTenantCredentials(ORG, EMAIL, "wrong-again");
    }
    const locked = await verifyTenantCredentials(ORG, EMAIL, PASSWORD);
    expect(locked).toBeNull(); // correct password, but locked out
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ locked_until: string | null; failed_login_count: number }[]>`
        select locked_until, failed_login_count from tenant_users where id = ${ids.tenantId}`;
    });
    expect(row!.locked_until).not.toBeNull();
  }, 40_000);
});
