/**
 * Web push — automated verification of the REAL send path (not the stub).
 *
 * setup-env.ts strips VAPID so push runs as a no-op in the suite; here we
 * re-set the keys via vi.hoisted (before push.ts loads) and mock ONLY the
 * network transport (`web-push`), so we exercise the actual sendWebPush +
 * dispatchInline code and assert:
 *   - the exact payload shape {title,body,url,tag} the service workers read,
 *   - the subscription {endpoint,keys} handed to web-push,
 *   - 404/410 → gone → subscription pruned,
 *   - the push channel is really invoked by the dispatcher with the deep link.
 *
 * DB-backed cases auto-skip without DATABASE_URL; the pure send-path cases
 * always run.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  // Runs before imports (after setup-env deleted these) → push.ts loads "configured".
  process.env.VAPID_PUBLIC_KEY = "test-vapid-public";
  process.env.VAPID_PRIVATE_KEY = "test-vapid-private";
  process.env.VAPID_SUBJECT = "mailto:test@stack.test";
});

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

import webpush from "web-push";
import postgres from "postgres";
import { sendWebPush, pushConfigured } from "@/lib/server/push";
import { dispatchInline } from "@/lib/server/notifications";

const sendMock = webpush.sendNotification as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ statusCode: 201 });
});

describe("web push — send path (no DB)", () => {
  it("is configured (VAPID present) so the real branch runs", () => {
    expect(pushConfigured()).toBe(true);
  });

  it("sends the exact {title,body,url,tag} payload to the subscription", async () => {
    const payload = { title: "Update on your request", body: "Now: scheduled.", url: "/tenant/WO-42", tag: "wo-42" };
    const r = await sendWebPush({ endpoint: "https://push.test/abc", p256dh: "PKEY", auth: "AKEY" }, payload);
    expect(r).toEqual({ ok: true, gone: false });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [sub, json] = sendMock.mock.calls[0]!;
    expect(sub).toEqual({ endpoint: "https://push.test/abc", keys: { p256dh: "PKEY", auth: "AKEY" } });
    expect(JSON.parse(json as string)).toEqual(payload); // shape the SW handlers read
  });

  it("reports gone=true on a 410 so the caller prunes", async () => {
    sendMock.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    const r = await sendWebPush({ endpoint: "https://push.test/x", p256dh: "p", auth: "a" }, { title: "t", body: "b" });
    expect(r.ok).toBe(false);
    expect(r.gone).toBe(true);
  });

  it("reports gone=false on a transient error (no prune)", async () => {
    sendMock.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    const r = await sendWebPush({ endpoint: "https://push.test/x", p256dh: "p", auth: "a" }, { title: "t", body: "b" });
    expect(r.ok).toBe(false);
    expect(r.gone).toBe(false);
  });
});

// ---- DB-backed: the dispatcher actually invokes push end-to-end ----
const ORG = `org_wpush_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { tenantId: "", unitId: "", propertyId: "", subId: "" };

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
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"1"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status) values (${ORG}, ${ids.unitId}, ${`r_${Date.now()}@lucid.test`}, ${"R"}, 'active') returning id`;
    ids.tenantId = t!.id;
    const [s] = await tx<{ id: string }[]>`insert into tenant_push_subscriptions (org_id, tenant_user_id, endpoint, p256dh, auth)
      values (${ORG}, ${ids.tenantId}, ${"https://push.test/tenant-1"}, ${"PK"}, ${"AK"}) returning id`;
    ids.subId = s!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from tenant_push_subscriptions where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("web push — dispatcher invokes push with the deep link", () => {
  it("fans out to the tenant's subscription and records a sent push row", async () => {
    const targetId = crypto.randomUUID();
    await dispatchInline({
      orgId: ORG,
      recipientTenantUserId: ids.tenantId,
      recipientEmail: null,
      recipientPhone: null,
      kind: "wo_status",
      subject: "Update on your request",
      body: "Your request is now: scheduled.",
      url: "/tenant/WO-42",
      targetType: "work_order",
      targetId,
      dedupeKey: `wpush:${targetId}`,
    });
    // The real dispatcher called web-push with our deep-link payload.
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [sub, json] = sendMock.mock.calls[0]!;
    expect((sub as { endpoint: string }).endpoint).toBe("https://push.test/tenant-1");
    const payload = JSON.parse(json as string);
    expect(payload.url).toBe("/tenant/WO-42");
    expect(payload.title).toBe("Update on your request");
    // And it recorded a push notification row marked sent.
    const rows = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ status: string }[]>`select status from notifications
        where org_id = ${ORG} and channel = 'push' and target_id = ${targetId}`;
    });
    expect(rows.map((r) => r.status)).toContain("sent");
  }, 30_000);

  it("prunes the subscription when the push service says gone (410)", async () => {
    sendMock.mockReset();
    sendMock.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const targetId = crypto.randomUUID();
    await dispatchInline({
      orgId: ORG,
      recipientTenantUserId: ids.tenantId,
      recipientEmail: null,
      recipientPhone: null,
      kind: "wo_status",
      subject: "Update",
      body: "…",
      url: "/tenant/WO-43",
      targetType: "work_order",
      targetId,
      dedupeKey: `wpush:${targetId}`,
    });
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ deleted: boolean }[]>`select (deleted_at is not null) deleted from tenant_push_subscriptions where id = ${ids.subId}`;
    });
    expect(row!.deleted).toBe(true); // gone subscription pruned
  }, 30_000);
});
