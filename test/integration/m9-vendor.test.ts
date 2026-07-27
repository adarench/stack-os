/**
 * M9 external-vendor workflow (VEN) — a vendor_user sees + messages on the WOs
 * assigned to them, and cannot touch anyone else's. Enforced by RLS
 * (work_orders_vendor_assigned, comments_vendor_external, comments_vendor_insert)
 * through `withVendorScope`. Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import postgres from "postgres";
import { loadVendorWorkOrder, vendorPostMessage } from "@/lib/server/vendor-work-orders";
import type { VendorSession } from "@/lib/server/vendor-auth";

const ORG = `org_m9_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = {
  vendorId: "",
  vu1: "", // assigned vendor_user
  vu2: "", // a different vendor_user (not assigned)
  woId: "",
  woNum: 0,
};

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

const session = (vendorUserId: string): VendorSession => ({
  orgId: ORG,
  vendorUserId,
  vendorId: ids.vendorId,
});

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [v] = await tx<{ id: string }[]>`
      insert into vendors (org_id, name) values (${ORG}, ${"Acme HVAC"}) returning id`;
    ids.vendorId = v!.id;
    const [a] = await tx<{ id: string }[]>`
      insert into vendor_users (org_id, vendor_id, email, name)
      values (${ORG}, ${ids.vendorId}, ${"pat@acme.test"}, ${"Pat Acme"}) returning id`;
    ids.vu1 = a!.id;
    const [b] = await tx<{ id: string }[]>`
      insert into vendor_users (org_id, vendor_id, email, name)
      values (${ORG}, ${ids.vendorId}, ${"lee@acme.test"}, ${"Lee Acme"}) returning id`;
    ids.vu2 = b!.id;
    const [wo] = await tx<{ id: string; number: number }[]>`
      insert into work_orders (org_id, number, title, description, status, kind, priority, category, created_by_actor_type)
      values (${ORG}, 9001, ${"Rooftop unit service"}, ${"Quarterly PM"}, 'assigned', 'work_order', 'normal', 'hvac', 'user') returning id, number`;
    ids.woId = wo!.id; ids.woNum = wo!.number;
    // Assign the WO to vu1 only.
    await tx`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id)
      values (${ORG}, 'work_order', ${ids.woId}, 'vendor_user', ${ids.vu1})`;
    // An operator-authored external message the vendor should see.
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, visibility)
      values (${ORG}, 'work_order', ${ids.woId}, ${"Please service before Friday."}, 'user', 'external')`;
    // An internal note the vendor must NOT see.
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, visibility)
      values (${ORG}, 'work_order', ${ids.woId}, ${"Internal: budget code 44."}, 'user', 'internal')`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from comments where org_id = ${ORG}`;
    await tx`delete from assignments where org_id = ${ORG}`;
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from vendor_users where org_id = ${ORG}`;
    await tx`delete from vendors where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("M9 vendor workflow", () => {
  it("VEN: the assigned vendor sees the WO detail + external messages, never internal notes", async () => {
    const wo = await loadVendorWorkOrder(session(ids.vu1), `WO-${ids.woNum}`);
    expect(wo).not.toBeNull();
    expect(wo!.ref).toBe(`WO-${ids.woNum}`);
    expect(wo!.title).toBe("Rooftop unit service");
    const bodies = wo!.messages.map((m) => m.body);
    expect(bodies).toContain("Please service before Friday."); // external
    expect(bodies.some((b) => b.includes("Internal: budget code 44."))).toBe(false); // internal never
  }, 20_000);

  it("VEN: the vendor can post a message, which then appears in the thread", async () => {
    await vendorPostMessage(session(ids.vu1), {
      workOrderId: ids.woId,
      body: "On site now, starting the PM.",
    });
    const wo = await loadVendorWorkOrder(session(ids.vu1), `WO-${ids.woNum}`);
    const mine = wo!.messages.find((m) => m.fromVendor);
    expect(mine?.body).toBe("On site now, starting the PM.");
  }, 20_000);

  it("VEN: a different (unassigned) vendor_user cannot see the WO (RLS)", async () => {
    const wo = await loadVendorWorkOrder(session(ids.vu2), `WO-${ids.woNum}`);
    expect(wo).toBeNull();
  }, 20_000);

  it("VEN: an unassigned vendor_user cannot post a message (RLS blocks the write)", async () => {
    await expect(
      vendorPostMessage(session(ids.vu2), { workOrderId: ids.woId, body: "I shouldn't be able to." }),
    ).rejects.toThrow();
    // And nothing from vu2 landed.
    const wo = await loadVendorWorkOrder(session(ids.vu1), `WO-${ids.woNum}`);
    expect(wo!.messages.some((m) => m.body.includes("I shouldn't be able to."))).toBe(false);
  }, 20_000);
});
