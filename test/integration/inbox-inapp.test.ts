/**
 * In-app notifications end-to-end: the real dispatcher writes an in_app row and
 * the real inbox query (loadInbox / loadInboxSummary — the exact queries the bell
 * + /inbox use) surfaces it for the recipient, with the WO deep-ref resolved and
 * an unread count. Runs on CI against stack_os_ci; also executed once against the
 * production DB to prod-verify the channel. Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_inbox_${Date.now()}`;
const SUBJECT = `local:inbox_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: SUBJECT, orgId: ORG, email: "inbox@ops.test", name: "Inbox", role: "admin" })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { dispatchInline } from "@/lib/server/notifications";
import { loadInbox, loadInboxSummary } from "@/lib/server/inbox";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { staffId: "", woId: "", woNum: 0 };

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
    const [s] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${SUBJECT}, ${"inbox@ops.test"}, ${"Inbox"}, 'admin') returning id`;
    ids.staffId = s!.id;
    const n = 90000 + Math.floor((Date.now() % 9000));
    const [w] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, description, status, kind, priority, category, created_by_actor_type, created_by_user_id)
      values (${ORG}, ${n}, ${"Lobby door"}, ${"Won't latch"}, 'assigned', 'work_order', 'normal', 'general', 'user', ${ids.staffId}) returning id, number`;
    ids.woId = w!.id; ids.woNum = w!.number;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("in-app notifications (inbox)", () => {
  it("dispatch writes an in_app row that the inbox query surfaces with the WO ref + unread", async () => {
    const subject = `WO-${ids.woNum} assigned to you`;
    await dispatchInline({
      orgId: ORG,
      recipientUserId: ids.staffId,
      kind: "wo_assigned",
      subject,
      body: "You have a new assignment.",
      targetType: "work_order",
      targetId: ids.woId,
      dedupeKey: `inbox:${ids.woId}`,
    });

    const inbox = await loadInbox();
    const row = inbox.find((n) => n.subject === subject);
    expect(row, "expected the in-app notification in the inbox").toBeTruthy();
    expect(row!.channel).toBe("in_app");
    expect(row!.targetRef).toBe(`WO-${ids.woNum}`); // deep-ref resolved
    expect(row!.unread).toBe(true);

    const summary = await loadInboxSummary();
    expect(summary.unread).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
