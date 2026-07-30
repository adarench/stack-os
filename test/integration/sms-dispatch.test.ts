/**
 * SMS dispatch — the body carries the app deep link, and the CPM/admin (ops team)
 * gets a text only when a call opts in via `sms:true`. The Twilio network send is
 * mocked; everything else is real. Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Replace only the Twilio send; keep smsConfigured etc.
vi.mock("@/lib/server/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/sms")>();
  return { ...actual, sendSms: vi.fn(async () => ({ id: "SMtest" })) };
});

import postgres from "postgres";
import { sendSms } from "@/lib/server/sms";
import { dispatchInline, notifyOpsTeam } from "@/lib/server/notifications";

const smsMock = sendSms as unknown as ReturnType<typeof vi.fn>;
const ORG = `org_sms_${Date.now()}`;
const TENANT_PHONE = "+15039151351";
const ADMIN_PHONE = "+18013809434";
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { tenantId: "", adminId: "", unitId: "", propertyId: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

beforeEach(() => smsMock.mockClear());

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"B"}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"1"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status, phone) values (${ORG}, ${ids.unitId}, ${`r_${Date.now()}@lucid.test`}, ${"Sam"}, 'active', ${TENANT_PHONE}) returning id`;
    ids.tenantId = t!.id;
    const [a] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role, phone) values (${ORG}, ${`local:jen_${Date.now()}`}, ${`jen_${Date.now()}@stackwithus.com`}, ${"Jen"}, 'admin', ${ADMIN_PHONE}) returning id`;
    ids.adminId = a!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("SMS dispatch", () => {
  it("texts the tenant with a branded body + the app deep link", async () => {
    const targetId = crypto.randomUUID();
    await dispatchInline({
      orgId: ORG,
      recipientTenantUserId: ids.tenantId,
      recipientPhone: TENANT_PHONE,
      recipientEmail: null,
      kind: "wo_status",
      subject: "Update on your request",
      body: "Now: scheduled.",
      url: "/tenant/WO-88",
      targetType: "work_order",
      targetId,
      dedupeKey: `sms:${targetId}`,
    });
    expect(smsMock).toHaveBeenCalledTimes(1);
    const arg = smsMock.mock.calls[0]![0] as { to: string; body: string };
    expect(arg.to).toBe(TENANT_PHONE);
    expect(arg.body).toContain("Stack OS ·");
    expect(arg.body).toContain("/tenant/WO-88"); // deep link present
    const rows = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ status: string }[]>`select status from notifications where org_id = ${ORG} and channel = 'sms' and target_id = ${targetId}`;
    });
    expect(rows.map((r) => r.status)).toContain("sent");
  }, 30_000);

  it("texts the ops team only when sms:true (CPM gets key-event alerts)", async () => {
    const t1 = crypto.randomUUID();
    await notifyOpsTeam({
      orgId: ORG,
      kind: "wo_submitted",
      subject: `New request WO-1`,
      body: "A resident reported an issue.",
      targetType: "work_order",
      targetId: t1,
      url: "/work-orders/x",
      sms: true,
      dedupeKey: `ops_sms:${t1}`,
    });
    expect(smsMock.mock.calls.some((c) => (c[0] as { to: string }).to === ADMIN_PHONE)).toBe(true);

    smsMock.mockClear();
    const t2 = crypto.randomUUID();
    await notifyOpsTeam({
      orgId: ORG,
      kind: "wo_resolved",
      subject: `Completed WO-1`,
      body: "Done.",
      targetType: "work_order",
      targetId: t2,
      url: "/work-orders/x",
      // sms omitted → no text
      dedupeKey: `ops_nosms:${t2}`,
    });
    expect(smsMock).not.toHaveBeenCalled();
  }, 30_000);
});
