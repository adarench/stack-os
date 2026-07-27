/**
 * AT-CANONICAL — the end-to-end Lucid acceptance loop, in one flow (M8).
 *
 * Lucid employee submits on mobile → system auto-assigns the covering tech →
 * tech acknowledges / starts / replies to the requester / notes internally /
 * completes (authoritatively) → requester sees a completion summary (tenant-safe)
 * and reopens. Asserts identity/attribution, assignment, the authoritative
 * completion summary, the internal-note boundary (no leak), the audit trail, and
 * cross-org isolation. Auto-skipped without DATABASE_URL.
 *
 * This is the single full-loop acceptance test the rollout plan flagged as
 * missing; the per-milestone tests cover each piece, this proves they compose.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_atc_${Date.now()}`;
const OTHER_ORG = `org_atc_other_${Date.now()}`;
const TECH_CLERK = `local:atc_tech_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: TECH_CLERK,
    orgId: ORG,
    email: "fernando@stack.test",
    name: "Fernando Reyes",
    role: "technician",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { createWorkOrderFromTenant, loadTenantMessages, tenantReopen } from "@/lib/server/tenant-work-orders";
import {
  loadTechnicianQueue,
  techAcknowledge,
  techSetStatus,
  techAddNote,
  techReplyToRequester,
  techComplete,
} from "@/lib/server/technician";
import { loadTenantRequest } from "@/lib/server/tenant-requests";
import type { CompletionSummary } from "@/lib/server/completion";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { techId: "", unitId: "", propertyId: "", tenantId: "", woId: "", woNum: 0 };
const NOTE = "Replaced compressor capacitor; verified 12°F delta.";
const REPLY = "On my way — should be fixed within the hour.";

async function sys(tx: postgres.Sql, org: string) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${org}, true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx, ORG);
    const [tech] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${ORG}, ${TECH_CLERK}, ${"fernando@stack.test"}, ${"Fernando Reyes"}, 'technician') returning id`;
    ids.techId = tech!.id;
    // Property's covering tech = Fernando → resident WOs on it auto-assign to him.
    const [p] = await tx<{ id: string }[]>`
      insert into properties (org_id, name, default_assignee_user_id)
      values (${ORG}, ${"Lucid HQ"}, ${ids.techId}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label, floor, suite)
      values (${ORG}, ${ids.propertyId}, ${"Suite 1200"}, ${"12"}, ${"1200"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, name, status)
      values (${ORG}, ${ids.unitId}, ${"jordan@lucid.test"}, ${"Jordan Lucid"}, 'active') returning id`;
    ids.tenantId = t!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  for (const org of [ORG, OTHER_ORG]) {
    await admin.begin(async (tx) => {
      await sys(tx, org);
      await tx`delete from notifications where org_id = ${org}`;
      await tx`delete from audit_log where org_id = ${org}`;
      await tx`delete from comments where org_id = ${org}`;
      await tx`delete from attachments where org_id = ${org}`;
      await tx`delete from assignments where org_id = ${org}`;
      await tx`delete from work_orders where org_id = ${org}`;
      await tx`delete from tenant_users where org_id = ${org}`;
      await tx`delete from units where org_id = ${org}`;
      await tx`delete from properties where org_id = ${org}`;
      await tx`delete from users where org_id = ${org}`;
    });
  }
  await admin.end();
});

const tenantSession = () => ({ orgId: ORG, tenantUserId: ids.tenantId });

describe.skipIf(skip)("AT-CANONICAL: the full Lucid loop", () => {
  it("1. tenant submit auto-assigns the covering tech, with identity + audit (ASN-001, IDN-001)", async () => {
    await createWorkOrderFromTenant(tenantSession(), {
      category: "hvac",
      title: "AC not cooling in Suite 1200",
      description: "It's 82°F and climbing.",
      priority: "high",
    });
    const [wo] = await admin!.begin(async (tx) => {
      await sys(tx, ORG);
      return tx<{ id: string; number: number; status: string; created_by_tenant_user_id: string }[]>`
        select id, number, status, created_by_tenant_user_id from work_orders
        where org_id = ${ORG} and unit_id = ${ids.unitId} order by created_at desc limit 1`;
    });
    ids.woId = wo!.id; ids.woNum = wo!.number;
    expect(wo!.status).toBe("assigned"); // not left "new"/unassigned
    expect(wo!.created_by_tenant_user_id).toBe(ids.tenantId); // individual identity

    const [asn] = await admin!.begin(async (tx) => {
      await sys(tx, ORG);
      return tx<{ assignee_id: string }[]>`
        select assignee_id from assignments
        where org_id = ${ORG} and target_type='work_order' and target_id=${ids.woId} and assignee_type='user'`;
    });
    expect(asn!.assignee_id).toBe(ids.techId); // covering tech

    const audit = await admin!.begin(async (tx) => {
      await sys(tx, ORG);
      return tx<{ action: string }[]>`
        select action from audit_log where org_id=${ORG} and target_id=${ids.woId}`;
    });
    expect(audit.some((a) => a.action === "created" || a.action === "tenant_submitted")).toBe(true);
  }, 30_000);

  it("2. the WO appears in the assigned tech's queue (TEC-002)", async () => {
    const queue = await loadTechnicianQueue();
    expect(queue.some((q) => q.ref === `WO-${ids.woNum}`)).toBe(true);
  }, 20_000);

  it("3. tech acknowledges → starts → replies to requester → notes internally (TEC-003..006)", async () => {
    const ref = `WO-${ids.woNum}`;
    await techAcknowledge(ref);
    await techSetStatus({ ref, to: "in_progress" });
    await techReplyToRequester(ref, REPLY);
    await techAddNote(ref, NOTE);
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx, ORG);
      return tx<{ status: string; acknowledged_at: string | null; started_at: string | null }[]>`
        select status, acknowledged_at, started_at from work_orders where id=${ids.woId}`;
    });
    expect(row!.status).toBe("in_progress");
    expect(row!.acknowledged_at).not.toBeNull();
    expect(row!.started_at).not.toBeNull();
  }, 30_000);

  it("4. tech completes authoritatively → resolved + structured summary (TEC-009, SUM-001)", async () => {
    await techComplete(`WO-${ids.woNum}`);
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx, ORG);
      return tx<{ status: string; completed_at: string | null; completion_summary: CompletionSummary | null }[]>`
        select status, completed_at, completion_summary from work_orders where id=${ids.woId}`;
    });
    expect(row!.status).toBe("resolved");
    expect(row!.completed_at).not.toBeNull();
    const s = row!.completion_summary!;
    expect(s.requester?.name).toBe("Jordan Lucid");
    expect(s.technician).toBe("Fernando Reyes");
    expect(s.location.suite).toBe("1200");
    // Work-performed on the summary is the internal note (ops/tech record).
    expect(s.workPerformed).toContain(NOTE);
  }, 30_000);

  it("5. requester sees a tenant-safe completion — reply visible, internal note NEVER (TEN-008, no leak)", async () => {
    const req = await loadTenantRequest(tenantSession(), `WO-${ids.woNum}`);
    expect(req).not.toBeNull();
    expect(req!.completedAt).not.toBeNull();
    expect(req!.technician).toBe("Fernando Reyes"); // safe attribution
    // The tenant thread shows the external reply but not the internal note.
    const msgs = await loadTenantMessages(tenantSession(), `WO-${ids.woNum}`);
    const bodies = msgs.map((m) => m.body);
    expect(bodies).toContain(REPLY);
    expect(bodies.some((b) => b.includes(NOTE))).toBe(false); // internal note never leaks
  }, 20_000);

  it("6. requester reopens → back to in_progress, stale completedAt cleared (LIF-005)", async () => {
    await tenantReopen(tenantSession(), { workOrderId: ids.woId, note: "Still warm this morning." });
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx, ORG);
      return tx<{ status: string; completed_at: string | null }[]>`
        select status, completed_at from work_orders where id=${ids.woId}`;
    });
    expect(row!.status).toBe("in_progress");
    expect(row!.completed_at).toBeNull();
  }, 20_000);

  it("7. cross-org isolation — another org's resident cannot read this WO (SEC/RLS)", async () => {
    const otherReq = await loadTenantRequest(
      { orgId: OTHER_ORG, tenantUserId: "00000000-0000-0000-0000-000000000000" },
      `WO-${ids.woNum}`,
    );
    expect(otherReq).toBeNull();
  }, 20_000);
});
