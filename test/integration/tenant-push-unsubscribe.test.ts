/**
 * Push cleanup on sign-out (privacy on shared devices): a resident's push
 * subscription is removed when they sign out, so the device stops receiving
 * their notifications. Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { subscribeTenantPush, unsubscribeTenantPush } from "@/lib/server/tenant-work-orders";

const ORG = `org_push_${Date.now()}`;
const ENDPOINT = `https://push.example/ep_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { tenantId: "", unitId: "", propertyId: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

async function activeCount(): Promise<number> {
  const rows = await admin!.begin(async (tx) => {
    await sys(tx);
    return tx<{ n: number }[]>`select count(*)::int n from tenant_push_subscriptions
      where org_id = ${ORG} and endpoint = ${ENDPOINT} and deleted_at is null`;
  });
  return rows[0]!.n;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"B"}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"1"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status) values (${ORG}, ${ids.unitId}, ${`r_${Date.now()}@lucid.test`}, ${"R"}, 'active') returning id`;
    ids.tenantId = t!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from tenant_push_subscriptions where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("tenant push cleanup on sign-out", () => {
  it("subscribe creates an active row; unsubscribe removes it", async () => {
    const session = { orgId: ORG, tenantUserId: ids.tenantId };
    await subscribeTenantPush(session, { endpoint: ENDPOINT, p256dh: "k", auth: "a" });
    expect(await activeCount()).toBe(1);
    await unsubscribeTenantPush(session, ENDPOINT);
    expect(await activeCount()).toBe(0);
  }, 30_000);
});
