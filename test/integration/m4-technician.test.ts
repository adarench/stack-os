/**
 * M4 technician field workflow (TEC-002/003/008/009). Auto-skipped without
 * DATABASE_URL. Mocks auth() so `withStaffScope` runs as the technician.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_m4_${Date.now()}`;
const TECH_CLERK = `local:tech_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: TECH_CLERK,
    orgId: TEST_ORG,
    email: "oscar@t.test",
    name: "Oscar",
    role: "technician",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import {
  loadTechnicianQueue,
  loadTechnicianWorkOrder,
  techComplete,
  techSetStatus,
  techReplyToRequester,
} from "@/lib/server/technician";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
const NS = `m4_${Date.now()}`;
let admin: postgres.Sql | null = null;
const ids = { techId: "", unitId: "", propertyId: "", tenantId: "", mine: "", mineNum: 0, other: "", otherNum: 0 };

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
    const [tech] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${TEST_ORG}, ${TECH_CLERK}, ${"oscar@t.test"}, ${"Oscar"}, 'technician') returning id`;
    ids.techId = tech!.id;
    const [p] = await tx<{ id: string }[]>`
      insert into properties (org_id, name) values (${TEST_ORG}, ${"B1 " + NS}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label, floor, suite)
      values (${TEST_ORG}, ${ids.propertyId}, ${"Suite 301"}, ${"3"}, ${"301"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, name, status)
      values (${TEST_ORG}, ${ids.unitId}, ${"sam@t.test"}, ${"Sam"}, 'active') returning id`;
    ids.tenantId = t!.id;
    // WO assigned to me (in_progress → completable).
    const [mine] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, status, kind, priority, unit_id, property_id, created_by_actor_type, created_by_tenant_user_id)
      values (${TEST_ORG}, 5001, ${"AC broken"}, 'in_progress', 'work_order', 'high', ${ids.unitId}, ${ids.propertyId}, 'tenant', ${ids.tenantId}) returning id, number`;
    ids.mine = mine!.id; ids.mineNum = mine!.number;
    await tx`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id)
      values (${TEST_ORG}, 'work_order', ${ids.mine}, 'user', ${ids.techId})`;
    // WO NOT assigned to me.
    const [other] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, status, kind, priority, unit_id, property_id, created_by_actor_type)
      values (${TEST_ORG}, 5002, ${"Someone else's"}, 'assigned', 'work_order', 'normal', ${ids.unitId}, ${ids.propertyId}, 'user') returning id, number`;
    ids.other = other!.id; ids.otherNum = other!.number;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${TEST_ORG}`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from comments where org_id = ${TEST_ORG}`;
    await tx`delete from assignments where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from tenant_users where org_id = ${TEST_ORG}`;
    await tx`delete from units where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("M4 technician workflow", () => {
  it("TEC-002: queue shows only my assigned work", async () => {
    const q = await loadTechnicianQueue();
    const nums = q.map((w) => w.number);
    expect(nums).toContain(ids.mineNum);
    expect(nums).not.toContain(ids.otherNum);
  }, 20_000);

  it("TEC-003: detail includes requester + suite/floor for my WO; null for others", async () => {
    const detail = await loadTechnicianWorkOrder(`WO-${ids.mineNum}`);
    expect(detail).not.toBeNull();
    expect(detail!.requester).toBe("Sam");
    expect(detail!.suite).toBe("301");
    expect(detail!.floor).toBe("3");
    expect(detail!.nextStatuses).toContain("resolved");

    const notMine = await loadTechnicianWorkOrder(`WO-${ids.otherNum}`);
    expect(notMine).toBeNull();
  }, 20_000);

  it("TEC-008: cannot act on a WO not assigned to me", async () => {
    await expect(techSetStatus({ ref: `WO-${ids.otherNum}`, to: "in_progress" })).rejects.toThrow("not_found");
  }, 20_000);

  it("TEC-009: technician completion is authoritative (in_progress → resolved + completedAt)", async () => {
    await techComplete(`WO-${ids.mineNum}`);
    const [wo] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ status: string; completed_at: string | null }[]>`
        select status, completed_at from work_orders where id = ${ids.mine}`;
    });
    expect(wo!.status).toBe("resolved");
    expect(wo!.completed_at).not.toBeNull();
  }, 20_000);

  it("TEC-005: reply-to-requester posts an external (resident-visible) message", async () => {
    await techReplyToRequester(`WO-${ids.mineNum}`, "On my way up to Suite 301.");
    const rows = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ visibility: string }[]>`
        select visibility from comments where org_id = ${TEST_ORG} and target_id = ${ids.mine} and body like 'On my way%'`;
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.visibility).toBe("external");
  }, 20_000);
});
