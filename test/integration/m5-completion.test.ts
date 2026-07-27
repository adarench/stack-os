/**
 * M5 completion lifecycle (SUM-001/002, LIF-005 reopen clears completedAt,
 * LIF-007 blockedReason). Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_m5_${Date.now()}`;
const TECH_CLERK = `local:tech5_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: TECH_CLERK,
    orgId: TEST_ORG,
    email: "oscar@t.test",
    name: "Oscar Diaz",
    role: "technician",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { techComplete } from "@/lib/server/technician";
import { updateWorkOrderStatus } from "@/lib/server/work-orders";
import { tenantReopen } from "@/lib/server/tenant-work-orders";
import type { CompletionSummary } from "@/lib/server/completion";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
const NS = `m5_${Date.now()}`;
let admin: postgres.Sql | null = null;
const ids = { techId: "", unitId: "", propertyId: "", tenantId: "", woId: "", woNum: 0 };

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
      values (${TEST_ORG}, ${TECH_CLERK}, ${"oscar@t.test"}, ${"Oscar Diaz"}, 'technician') returning id`;
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
      values (${TEST_ORG}, ${ids.unitId}, ${"sam@t.test"}, ${"Sam Lucid"}, 'active') returning id`;
    ids.tenantId = t!.id;
    const [wo] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, description, status, kind, priority, category, unit_id, property_id, created_by_actor_type, created_by_tenant_user_id, started_at)
      values (${TEST_ORG}, 6001, ${"AC not cooling"}, ${"Unit is 85F"}, 'in_progress', 'work_order', 'high', 'hvac', ${ids.unitId}, ${ids.propertyId}, 'tenant', ${ids.tenantId}, now()) returning id, number`;
    ids.woId = wo!.id; ids.woNum = wo!.number;
    await tx`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id)
      values (${TEST_ORG}, 'work_order', ${ids.woId}, 'user', ${ids.techId})`;
    // "Work performed" note + a completion photo.
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, visibility)
      values (${TEST_ORG}, 'work_order', ${ids.woId}, ${"Recharged refrigerant, replaced filter."}, 'user', 'internal')`;
    await tx`insert into attachments (org_id, target_type, target_id, kind, storage_key, content_type, uploaded_by_actor_type)
      values (${TEST_ORG}, 'work_order', ${ids.woId}, 'after_photo', ${TEST_ORG + "/after.jpg"}, ${"image/jpeg"}, 'user')`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${TEST_ORG}`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from comments where org_id = ${TEST_ORG}`;
    await tx`delete from attachments where org_id = ${TEST_ORG}`;
    await tx`delete from assignments where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from tenant_users where org_id = ${TEST_ORG}`;
    await tx`delete from units where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("M5 completion lifecycle", () => {
  it("SUM-001: completion captures a structured summary from WO history", async () => {
    await techComplete(`WO-${ids.woNum}`);
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ completion_summary: CompletionSummary | null; completed_at: string | null }[]>`
        select completion_summary, completed_at from work_orders where id = ${ids.woId}`;
    });
    expect(row!.completed_at).not.toBeNull();
    const s = row!.completion_summary!;
    expect(s).not.toBeNull();
    expect(s.woNumber).toBe(ids.woNum);
    expect(s.finalStatus).toBe("resolved");
    expect(s.requester?.name).toBe("Sam Lucid");
    expect(s.technician).toBe("Oscar Diaz");
    expect(s.location.suite).toBe("301");
    expect(s.originalIssue).toBe("Unit is 85F");
    expect(s.workPerformed).toContain("Recharged refrigerant, replaced filter.");
    expect(s.photoKeys.length).toBe(1);
  }, 20_000);

  it("LIF-005: reopening clears the stale completedAt", async () => {
    await tenantReopen(
      { orgId: TEST_ORG, tenantUserId: ids.tenantId },
      { workOrderId: ids.woId, note: "Still not cooling." },
    );
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ status: string; completed_at: string | null }[]>`
        select status, completed_at from work_orders where id = ${ids.woId}`;
    });
    expect(row!.status).toBe("in_progress");
    expect(row!.completed_at).toBeNull();
  }, 20_000);

  it("LIF-007: blocking records the blockedReason", async () => {
    await updateWorkOrderStatus({ id: ids.woId, to: "blocked", blockedReason: "waiting_vendor" });
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ blocked_reason: string | null }[]>`
        select blocked_reason from work_orders where id = ${ids.woId}`;
    });
    expect(row!.blocked_reason).toBe("waiting_vendor");
  }, 20_000);
});
