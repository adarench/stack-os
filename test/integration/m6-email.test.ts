/**
 * M6 email notifications — EML-004 (staff status email now has a recipient,
 * previously in_app-only) and EML-009 (idempotency: a retried dispatch is a
 * no-op, not a double-send). Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_m6_${Date.now()}`;
const STAFF_CLERK = `local:staff6_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: STAFF_CLERK,
    orgId: TEST_ORG,
    email: "dana@ops.test",
    name: "Dana Ops",
    role: "admin",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { updateWorkOrderStatus } from "@/lib/server/work-orders";
import { dispatchInline } from "@/lib/server/notifications";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { staffId: "", woId: "", woNum: 0 };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [staff] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${TEST_ORG}, ${STAFF_CLERK}, ${"dana@ops.test"}, ${"Dana Ops"}, 'admin') returning id`;
    ids.staffId = staff!.id;
    const [wo] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, description, status, kind, priority, category, created_by_actor_type, created_by_user_id, started_at)
      values (${TEST_ORG}, 6101, ${"Lobby light out"}, ${"Flickering"}, 'in_progress', 'work_order', 'normal', 'electrical', 'user', ${ids.staffId}, now()) returning id, number`;
    ids.woId = wo!.id; ids.woNum = wo!.number;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${TEST_ORG}`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("M6 email notifications", () => {
  it("EML-004: a staff status change records an EMAIL notification with the creator as recipient", async () => {
    await updateWorkOrderStatus({ id: ids.woId, to: "resolved" });
    const rows = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ channel: string; recipient_user_id: string; status: string }[]>`
        select channel, recipient_user_id, status from notifications
        where org_id = ${TEST_ORG} and target_id = ${ids.woId} and kind = 'wo_resolved'`;
    });
    const email = rows.find((r) => r.channel === "email");
    // Before EML-004 this was null → the email channel was skipped entirely.
    expect(email, "expected an email-channel notification for the staff creator").toBeTruthy();
    expect(email!.recipient_user_id).toBe(ids.staffId);
    expect(email!.status).toBe("sent"); // stub send (no RESEND_API_KEY) marks sent
  }, 20_000);

  it("EML-009: dispatching the same event twice with one dedupeKey sends once", async () => {
    const dedupeKey = `test_dedupe:${ids.woId}:once`;
    const payload = {
      orgId: TEST_ORG,
      recipientUserId: ids.staffId,
      recipientEmail: "dana@ops.test",
      kind: "wo_status" as const,
      subject: "Test dedupe",
      body: "Only one of me should exist.",
      targetType: "work_order" as const,
      targetId: ids.woId,
      dedupeKey,
    };
    await dispatchInline(payload);
    await dispatchInline(payload); // retry — must be a no-op

    const counts = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ channel: string; n: number }[]>`
        select channel, count(*)::int as n from notifications
        where org_id = ${TEST_ORG} and idempotency_key like ${dedupeKey + ":%"}
        group by channel`;
    });
    const emailCount = counts.find((c) => c.channel === "email")?.n ?? 0;
    expect(emailCount).toBe(1); // exactly one email despite two dispatches
    // Every recorded channel is deduped, so none exceeds one row.
    for (const c of counts) expect(c.n).toBe(1);
  }, 20_000);
});
