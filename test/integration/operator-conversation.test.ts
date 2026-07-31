/**
 * Operator conversation thread — the requester-visible messages on a work order
 * must surface real sender names (the resident's actual name, the staffer's
 * name), never the literal actor-type word "tenant". Regression guard for the
 * loadComments name resolution behind the drawer's Conversation tab.
 * Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_conv_${Date.now()}`;
const OP_CLERK = `local:convop_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: OP_CLERK, orgId: ORG, email: "op@ops.test", name: "Op", role: "dispatcher" })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { createWorkOrder } from "@/lib/server/work-orders";
import { loadEntityDetail } from "@/lib/server/entity-detail";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { staffId: "", tenantId: "", woId: "", woNumber: 0 };
const STAFF_NAME = "Dana Dispatcher";
const TENANT_NAME = "Sam Resident";

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
    const [op] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_CLERK}, ${"op@ops.test"}, ${STAFF_NAME}, 'dispatcher') returning id`;
    ids.staffId = op!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, email, name, status) values (${ORG}, ${"sam@resident.test"}, ${TENANT_NAME}, 'active') returning id`;
    ids.tenantId = t!.id;
  });

  const wo = await createWorkOrder({ title: "Kitchen sink leak" });
  ids.woId = wo.id;
  ids.woNumber = wo.number;

  await admin.begin(async (tx) => {
    await sys(tx);
    // Tenant-reported: link the requester so the drawer shows the Conversation tab.
    await tx`update work_orders set created_by_tenant_user_id=${ids.tenantId} where id=${ids.woId}`;
    // One inbound resident message + one outbound staff reply, both requester-visible.
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility)
             values (${ORG}, 'work_order', ${ids.woId}, ${"Water is pooling under the sink."}, 'tenant', ${ids.tenantId}, 'external')`;
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility)
             values (${ORG}, 'work_order', ${ids.woId}, ${"Thanks Sam — a tech is on the way."}, 'user', ${ids.staffId}, 'external')`;
    // An internal note must never leak into the requester thread.
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility)
             values (${ORG}, 'work_order', ${ids.woId}, ${"Shutoff valve is behind the dishwasher."}, 'user', ${ids.staffId}, 'internal')`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    for (const t of ["comments", "assignments", "audit_log", "work_orders", "tenant_users", "users"]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });
  await admin.end();
});

describe.skipIf(skip)("operator conversation thread", () => {
  it("resolves real sender names on requester-visible messages", async () => {
    const detail = await loadEntityDetail(`WO-${ids.woNumber}`);
    expect(detail).not.toBeNull();
    const external = detail!.comments.filter((c) => c.visibility === "external");

    const inbound = external.find((c) => c.actorType === "tenant");
    expect(inbound, "resident message present").toBeDefined();
    // The core fix: a real name, not the literal "tenant".
    expect(inbound!.actorName).toBe(TENANT_NAME);
    expect(inbound!.actorName).not.toBe("tenant");

    const outbound = external.find((c) => c.actorType === "user");
    expect(outbound, "staff reply present").toBeDefined();
    expect(outbound!.actorName).toBe(STAFF_NAME);
  }, 30_000);

  it("keeps internal notes out of the requester thread", async () => {
    const detail = await loadEntityDetail(`WO-${ids.woNumber}`);
    const external = detail!.comments.filter((c) => c.visibility === "external");
    expect(external).toHaveLength(2);
    expect(external.some((c) => c.body.includes("Shutoff valve"))).toBe(false);
    // The requester is resolved so the Conversation tab renders in the drawer.
    expect(detail!.requester?.name).toBe(TENANT_NAME);
  }, 30_000);
});
