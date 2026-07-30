/**
 * Native (APNs) push wiring — the token round-trip and that the dispatcher fans
 * out to a tenant's device token with the deep link. The APNs network send is
 * mocked (real delivery needs an Apple key + device); everything else is real.
 * Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Replace only the network send; keep the real token save/load/prune helpers.
vi.mock("@/lib/server/apns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/apns")>();
  return { ...actual, sendApns: vi.fn(async () => ({ ok: true, gone: false })) };
});

import postgres from "postgres";
import { sendApns } from "@/lib/server/apns";
import { registerTenantDeviceToken, unregisterTenantDeviceToken } from "@/lib/server/tenant-work-orders";
import { dispatchInline } from "@/lib/server/notifications";

const sendMock = sendApns as unknown as ReturnType<typeof vi.fn>;
const ORG = `org_apns_${Date.now()}`;
const TOKEN = `apnstoken_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { tenantId: "", unitId: "", propertyId: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}
async function activeTokens(): Promise<number> {
  const rows = await admin!.begin(async (tx) => {
    await sys(tx);
    return tx<{ n: number }[]>`select count(*)::int n from tenant_device_tokens
      where org_id = ${ORG} and token = ${TOKEN} and deleted_at is null`;
  });
  return rows[0]!.n;
}

beforeEach(() => sendMock.mockClear());

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
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from tenant_device_tokens where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("native push (APNs) wiring", () => {
  it("register stores a device token; unregister removes it", async () => {
    const session = { orgId: ORG, tenantUserId: ids.tenantId };
    await registerTenantDeviceToken(session, { token: TOKEN, platform: "ios" });
    expect(await activeTokens()).toBe(1);
    await unregisterTenantDeviceToken(session, TOKEN);
    expect(await activeTokens()).toBe(0);
  }, 30_000);

  it("dispatcher sends APNs to the tenant's device token with the deep link", async () => {
    const session = { orgId: ORG, tenantUserId: ids.tenantId };
    await registerTenantDeviceToken(session, { token: TOKEN, platform: "ios" });

    const targetId = crypto.randomUUID();
    await dispatchInline({
      orgId: ORG,
      recipientTenantUserId: ids.tenantId,
      recipientEmail: null,
      recipientPhone: null,
      kind: "wo_status",
      subject: "Update on your request",
      body: "Now: scheduled.",
      url: "/tenant/WO-77",
      targetType: "work_order",
      targetId,
      dedupeKey: `apns:${targetId}`,
    });

    // The real dispatcher reached APNs with our payload — even with NO web sub.
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [token, payload] = sendMock.mock.calls[0]!;
    expect(token).toBe(TOKEN);
    expect(payload).toMatchObject({ title: "Update on your request", url: "/tenant/WO-77" });

    // And the push notification row was recorded as sent.
    const rows = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ status: string }[]>`select status from notifications
        where org_id = ${ORG} and channel = 'push' and target_id = ${targetId}`;
    });
    expect(rows.map((r) => r.status)).toContain("sent");

    await unregisterTenantDeviceToken(session, TOKEN);
  }, 30_000);
});
