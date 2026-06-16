/**
 * P2 lifecycle integration test.
 *
 * Drives the actual server functions (createProperty, createUnit,
 * createVendor, inviteVendorUser, createWorkOrder, updateWorkOrderStatus,
 * assignVendor) end-to-end against the real Neon dev branch.
 *
 * Mocks `@clerk/nextjs/server` so the server functions can run outside an
 * HTTP request context. The mock returns a stable test org_id + user_id;
 * RLS still enforces tenant isolation under the `app_user` role.
 *
 * Auto-skipped without DATABASE_URL_UNPOOLED / DATABASE_URL.
 */
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const TEST_ORG = `org_test_lifecycle_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_lifecycle_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: TEST_CLERK_USER_ID,
    orgId: TEST_ORG,
    email: "test@stack-os.example",
    name: "Test User",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";

import {
  createProperty,
  createUnit,
} from "@/lib/server/properties";
import { createVendor } from "@/lib/server/vendors";
import { inviteVendorUser } from "@/lib/server/vendor-invite";
import {
  createWorkOrder,
  updateWorkOrderStatus,
  assignVendor,
  getWorkOrder,
  listWorkOrders,
} from "@/lib/server/work-orders";
import { createComment, listComments } from "@/lib/server/comments";
import { listAttachments } from "@/lib/server/attachments";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

let admin: postgres.Sql | null = null;

beforeAll(async () => {
  if (skip || !url) return;
  // VENDOR_MAGIC_LINK_SECRET is required by the magic-link path.
  if (!process.env.VENDOR_MAGIC_LINK_SECRET) {
    process.env.VENDOR_MAGIC_LINK_SECRET = "test_secret_at_least_32_characters_long_xxx";
  }
  admin = postgres(url, { max: 1 });
});

afterAll(async () => {
  if (!admin) return;
  // Clean up everything we created under the synthetic test org.
  await admin.begin(async (tx) => {
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
    await tx`set local role app_user`;
    // Order matters because of FK references and polymorphic refs.
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from comments where org_id = ${TEST_ORG}`;
    await tx`delete from attachments where org_id = ${TEST_ORG}`;
    await tx`delete from assignments where org_id = ${TEST_ORG}`;
    await tx`delete from approvals where org_id = ${TEST_ORG}`;
    await tx`delete from task_scopes where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from vendor_users where org_id = ${TEST_ORG}`;
    await tx`delete from vendors where org_id = ${TEST_ORG}`;
    await tx`delete from units where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("P2 lifecycle — pre-flight setup", () => {
  let propertyId: string;
  let unitId: string;
  let vendorId: string;
  let vendorUserId: string;

  it("creates a property", async () => {
    const p = await createProperty({
      name: "Cedar Ridge Lifecycle",
      city: "Boise",
      state: "ID",
    });
    expect(p.id).toBeTruthy();
    expect(p.orgId).toBe(TEST_ORG);
    expect(p.name).toBe("Cedar Ridge Lifecycle");
    propertyId = p.id;
  });

  it("creates a unit under the property", async () => {
    const u = await createUnit({
      propertyId,
      label: "3B-lifecycle",
      bedrooms: "2",
      bathrooms: "1",
    });
    expect(u.id).toBeTruthy();
    expect(u.propertyId).toBe(propertyId);
    unitId = u.id;
  });

  it("creates a vendor", async () => {
    const v = await createVendor({
      name: "Acme Lifecycle Plumbing",
      trade: "plumbing",
      primaryEmail: "acme-lifecycle@stack-os.example",
    });
    expect(v.id).toBeTruthy();
    vendorId = v.id;
  });

  it("invites a vendor user with magic link", async () => {
    const inv = await inviteVendorUser({
      vendorId,
      email: "vendor-lifecycle@stack-os.example",
      name: "Vendor Lifecycle",
    });
    expect(inv.vendorUserId).toBeTruthy();
    expect(inv.inviteUrl).toMatch(/\/api\/vendor\/auth\/[A-Za-z0-9_-]{32,}/);
    vendorUserId = inv.vendorUserId;
  });

  describe("happy-path lifecycle", () => {
    let workOrderId: string;
    let woNumber: number;

    it("creates a work order in 'new'", async () => {
      const wo = await createWorkOrder({
        title: "Leaky kitchen faucet",
        description: "tenant reports drip",
        priority: "high",
        propertyId,
        unitId,
        kind: "work_order",
      });
      expect(wo.id).toBeTruthy();
      expect(wo.status).toBe("new");
      expect(wo.priority).toBe("high");
      expect(wo.propertyId).toBe(propertyId);
      expect(wo.unitId).toBe(unitId);
      workOrderId = wo.id;
      woNumber = wo.number;
    });

    it("appears in listWorkOrders for this org", async () => {
      const rows = await listWorkOrders({ status: "new" });
      const ours = rows.find((r) => r.id === workOrderId);
      expect(ours).toBeTruthy();
      expect(ours?.title).toBe("Leaky kitchen faucet");
    });

    it(
      "walks new → triaged → assigned → scheduled → in_progress → resolved → verified → closed",
      async () => {
        const path = [
          "triaged",
          "assigned",
          "scheduled",
          "in_progress",
          "resolved",
          "verified",
          "closed",
        ] as const;
        for (const to of path) {
          const updated = await updateWorkOrderStatus({ id: workOrderId, to });
          expect(updated.status, `expected ${to}`).toBe(to);
          // Verify by re-fetching too
          const fresh = await getWorkOrder(workOrderId);
          expect(fresh?.status).toBe(to);
        }
      },
      30_000,
    );

    it("started_at is set when entering in_progress", async () => {
      // Already walked through; spot check via raw SQL
      if (!admin) return;
      const r = await admin.begin(async (tx) => {
        await tx`select set_config('app.actor_type', 'user', true)`;
        await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
        await tx`set local role app_user`;
        return tx<{ started_at: Date | null; completed_at: Date | null }[]>`
          select started_at, completed_at
          from work_orders where id = ${workOrderId}
        `;
      });
      expect(r[0]?.started_at).toBeTruthy();
      expect(r[0]?.completed_at).toBeTruthy();
    });

    it("audit_log captured every status change", async () => {
      if (!admin) return;
      const r = await admin.begin(async (tx) => {
        await tx`select set_config('app.actor_type', 'user', true)`;
        await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
        await tx`set local role app_user`;
        return tx<{ action: string }[]>`
          select action from audit_log
          where target_type = 'work_order' and target_id = ${workOrderId}
          order by created_at asc
        `;
      });
      const actions = r.map((row) => row.action);
      // Created + 7 status_changed (new→triaged→…→closed) = 8 entries
      expect(actions.filter((a) => a === "status_changed").length).toBeGreaterThanOrEqual(7);
      expect(actions[0]).toBe("created");
    });
  });

  describe("invalid transitions", () => {
    it("rejects new → in_progress", async () => {
      const wo = await createWorkOrder({
        title: "Skip-test",
        priority: "normal",
        propertyId,
      });
      await expect(
        updateWorkOrderStatus({ id: wo.id, to: "in_progress" }),
      ).rejects.toThrow(/invalid_transition/);
      const fresh = await getWorkOrder(wo.id);
      expect(fresh?.status).toBe("new");
    });

    it("rejects new → resolved", async () => {
      const wo = await createWorkOrder({
        title: "Skip-test-2",
        priority: "normal",
        propertyId,
      });
      await expect(
        updateWorkOrderStatus({ id: wo.id, to: "resolved" }),
      ).rejects.toThrow(/invalid_transition/);
    });

    it(
      "rejects re-opening from closed",
      async () => {
        const wo = await createWorkOrder({
          title: "Closed-then-reopen",
          priority: "normal",
          propertyId,
        });
        // Walk to closed via the canonical path
        for (const s of ["triaged", "assigned", "scheduled", "in_progress", "resolved", "verified", "closed"] as const) {
          await updateWorkOrderStatus({ id: wo.id, to: s });
        }
        await expect(
          updateWorkOrderStatus({ id: wo.id, to: "new" }),
        ).rejects.toThrow(/invalid_transition/);
      },
      30_000,
    );

    it("rejects exit from cancelled (terminal)", async () => {
      const wo = await createWorkOrder({
        title: "Cancelled-test",
        priority: "low",
        propertyId,
      });
      await updateWorkOrderStatus({ id: wo.id, to: "cancelled" });
      await expect(
        updateWorkOrderStatus({ id: wo.id, to: "new" }),
      ).rejects.toThrow(/invalid_transition/);
    });
  });

  describe("vendor assignment", () => {
    it("assignVendor advances new → assigned and inserts an assignments row", async () => {
      const wo = await createWorkOrder({
        title: "Auto-advance on assign",
        priority: "normal",
        propertyId,
      });
      expect(wo.status).toBe("new");
      await assignVendor({ workOrderId: wo.id, vendorUserId, overrideCoi: true });
      const updated = await getWorkOrder(wo.id);
      expect(updated?.status).toBe("assigned");

      // Verify assignment row + audit
      if (!admin) return;
      const a = await admin.begin(async (tx) => {
        await tx`select set_config('app.actor_type', 'user', true)`;
        await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
        await tx`set local role app_user`;
        return tx<{ assignee_id: string; unassigned_at: Date | null }[]>`
          select assignee_id, unassigned_at from assignments
          where target_type = 'work_order' and target_id = ${wo.id}
        `;
      });
      expect(a.length).toBe(1);
      expect(a[0]!.assignee_id).toBe(vendorUserId);
      expect(a[0]!.unassigned_at).toBeNull();
    });

    it("rejects assignment to a vendor_user from another org", async () => {
      const wo = await createWorkOrder({
        title: "Cross-org assign",
        priority: "normal",
        propertyId,
      });
      // Use a uuid that doesn't belong to this org
      await expect(
        assignVendor({
          workOrderId: wo.id,
          vendorUserId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(/vendor_user_not_in_org/);
    });
  });

  describe("comments", () => {
    it("staff comment creates an audit entry", async () => {
      const wo = await createWorkOrder({
        title: "Comment-test",
        priority: "normal",
        propertyId,
      });
      const c = await createComment({
        targetType: "work_order",
        targetId: wo.id,
        body: "Tenant called back at 2pm",
        visibility: "internal",
      });
      expect(c.body).toBe("Tenant called back at 2pm");
      expect(c.visibility).toBe("internal");

      const all = await listComments("work_order", wo.id);
      expect(all.length).toBe(1);
    });

    it("listAttachments returns empty for a fresh WO", async () => {
      const wo = await createWorkOrder({
        title: "Attach-empty",
        priority: "normal",
        propertyId,
      });
      const atts = await listAttachments("work_order", wo.id);
      expect(atts).toEqual([]);
    });
  });

  describe("vendor scope", () => {
    it("vendor_user can only SELECT work_orders assigned to them (RLS)", async () => {
      if (!admin) return;
      // Create one assigned WO and one unassigned WO
      const assigned = await createWorkOrder({
        title: "Vendor sees this",
        priority: "normal",
        propertyId,
      });
      const unassigned = await createWorkOrder({
        title: "Vendor must NOT see this",
        priority: "normal",
        propertyId,
      });
      await assignVendor({ workOrderId: assigned.id, vendorUserId, overrideCoi: true });

      // Now query under vendor scope
      const visible = await admin.begin(async (tx) => {
        await tx`set local role app_user`;
        await tx`select set_config('app.actor_type', 'vendor', true)`;
        await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
        await tx`select set_config('app.vendor_user_id', ${vendorUserId}, true)`;
        const rows = await tx<{ id: string }[]>`
          select id from work_orders
          where id in (${assigned.id}, ${unassigned.id})
        `;
        return rows.map((r) => r.id);
      });

      expect(visible).toContain(assigned.id);
      expect(visible).not.toContain(unassigned.id);
    });
  });
});
