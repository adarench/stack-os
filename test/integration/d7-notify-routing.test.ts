/**
 * D7 — status-change notification routing. The assigned technician must be told
 * when a work order's status changes (they're doing the work), and a
 * tenant-reported WO must reach STAFF at all — previously only the WO creator
 * (a staff user) was emailed, so tenant WOs (no staff creator) told nobody on
 * staff on blocked/verified. Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_d7_${Date.now()}`;
const OP_CLERK = `local:op7_${Date.now()}`; // the acting operator (NOT the assignee)

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: OP_CLERK, orgId: ORG, email: "op@ops.test", name: "Op", role: "admin" })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { updateWorkOrderStatus } from "@/lib/server/work-orders";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { opId: "", techId: "", op2Id: "", tenantId: "", propId: "", unitId: "", assignedWo: "", unassignedWo: "" };

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
    const [op] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_CLERK}, ${"op@ops.test"}, ${"Op"}, 'admin') returning id`;
    ids.opId = op!.id;
    const [op2] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${"local:op2"}, ${"op2@ops.test"}, ${"Op Two"}, 'dispatcher') returning id`;
    ids.op2Id = op2!.id;
    const [tech] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${"local:tech7"}, ${"oscar@field.test"}, ${"Oscar"}, 'technician') returning id`;
    ids.techId = tech!.id;
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"Bldg"}) returning id`;
    ids.propId = p!.id;
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propId}, ${"101"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status) values (${ORG}, ${ids.unitId}, ${"res@lucid.test"}, ${"Res"}, 'active') returning id`;
    ids.tenantId = t!.id;

    // A tenant-reported WO with the technician actively assigned.
    const [w1] = await tx<{ id: string }[]>`
      insert into work_orders (org_id, number, title, description, status, kind, priority, category, created_by_actor_type, created_by_tenant_user_id, started_at)
      values (${ORG}, 7101, ${"Leaking faucet"}, ${"Drip"}, 'in_progress', 'work_order', 'normal', 'plumbing', 'tenant', ${ids.tenantId}, now()) returning id`;
    ids.assignedWo = w1!.id;
    await tx`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id) values (${ORG}, 'work_order', ${ids.assignedWo}, 'user', ${ids.techId})`;

    // A tenant-reported WO with NOBODY assigned (safety-net path).
    const [w2] = await tx<{ id: string }[]>`
      insert into work_orders (org_id, number, title, description, status, kind, priority, category, created_by_actor_type, created_by_tenant_user_id, started_at)
      values (${ORG}, 7102, ${"No heat"}, ${"Cold"}, 'in_progress', 'work_order', 'normal', 'hvac', 'tenant', ${ids.tenantId}, now()) returning id`;
    ids.unassignedWo = w2!.id;
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
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

async function notifs(woId: string) {
  return admin!.begin(async (tx) => {
    await sys(tx);
    return tx<{ recipient_user_id: string | null; recipient_tenant_user_id: string | null; kind: string; channel: string }[]>`
      select recipient_user_id, recipient_tenant_user_id, kind, channel from notifications where org_id = ${ORG} and target_id = ${woId}`;
  });
}

describe.skipIf(skip)("D7 status-change routing", () => {
  it("notifies the assigned technician when an operator changes a tenant WO's status", async () => {
    await updateWorkOrderStatus({ id: ids.assignedWo, to: "blocked", blockedReason: "waiting_vendor" });
    const rows = await notifs(ids.assignedWo);
    // The assigned tech (≠ the acting operator) is notified — the core D7 fix.
    expect(rows.some((r) => r.recipient_user_id === ids.techId && r.kind === "wo_blocked")).toBe(true);
    // The acting operator is NOT self-pinged as the assignee.
    expect(rows.some((r) => r.recipient_user_id === ids.opId)).toBe(false);
    // The resident still gets their plain-language update.
    expect(rows.some((r) => r.recipient_tenant_user_id === ids.tenantId && r.kind === "wo_status")).toBe(true);
  }, 30_000);

  it("falls back to the ops team when a tenant WO with no assignee changes status", async () => {
    await updateWorkOrderStatus({ id: ids.unassignedWo, to: "blocked", blockedReason: "other" });
    const rows = await notifs(ids.unassignedWo);
    // No assignee + no staff creator → the other operator is alerted so it isn't lost.
    expect(rows.some((r) => r.recipient_user_id === ids.op2Id && r.kind === "wo_blocked")).toBe(true);
    // The acting operator is excluded from the safety-net broadcast.
    expect(rows.some((r) => r.recipient_user_id === ids.opId && r.kind === "wo_blocked")).toBe(false);
  }, 30_000);
});
