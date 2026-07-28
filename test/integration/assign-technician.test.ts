/**
 * Operator "assign to technician" (ASN) — assign an unassigned WO directly to a
 * tech (no vendor), advance new→assigned, and enforce a single active owner on
 * reassignment. Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_asntech_${Date.now()}`;
const OP_CLERK = `local:op_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: OP_CLERK,
    orgId: ORG,
    email: "op@stack.test",
    name: "Op Erator",
    role: "admin",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { assignTechnician } from "@/lib/server/work-orders";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { opId: "", techA: "", techB: "", woId: "", woNum: 0 };

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
    const [op] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${ORG}, ${OP_CLERK}, ${"op@stack.test"}, ${"Op Erator"}, 'admin') returning id`;
    ids.opId = op!.id;
    const [a] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${ORG}, ${"local:a"}, ${"oscar@x.test"}, ${"Oscar B"}, 'technician') returning id`;
    ids.techA = a!.id;
    const [b] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${ORG}, ${"local:b"}, ${"fernando@x.test"}, ${"Fernando S"}, 'technician') returning id`;
    ids.techB = b!.id;
    const [wo] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, status, kind, priority, category, created_by_actor_type, created_by_user_id)
      values (${ORG}, 7700, ${"Lobby door sticking"}, 'new', 'work_order', 'normal', 'general', 'user', ${ids.opId}) returning id, number`;
    ids.woId = wo!.id; ids.woNum = wo!.number;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from audit_log where org_id = ${ORG}`;
    await tx`delete from assignments where org_id = ${ORG}`;
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("assign to technician", () => {
  it("assigns an unassigned WO to a tech and advances new → assigned", async () => {
    await assignTechnician({ workOrderId: ids.woId, userId: ids.techA });
    const [wo] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ status: string }[]>`select status from work_orders where id = ${ids.woId}`;
    });
    expect(wo!.status).toBe("assigned");
    const active = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ assignee_id: string }[]>`
        select assignee_id from assignments
        where org_id = ${ORG} and target_id = ${ids.woId} and assignee_type = 'user' and unassigned_at is null`;
    });
    expect(active.length).toBe(1);
    expect(active[0]!.assignee_id).toBe(ids.techA);
  }, 20_000);

  it("reassigning retires the old owner — exactly one active user assignment", async () => {
    await assignTechnician({ workOrderId: ids.woId, userId: ids.techB });
    const active = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ assignee_id: string }[]>`
        select assignee_id from assignments
        where org_id = ${ORG} and target_id = ${ids.woId} and assignee_type = 'user' and unassigned_at is null`;
    });
    expect(active.length).toBe(1);
    expect(active[0]!.assignee_id).toBe(ids.techB);
  }, 20_000);
});
