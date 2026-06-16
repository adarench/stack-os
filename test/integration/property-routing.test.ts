/**
 * Property-routing integration test — the V1 wedge keystone.
 *
 * Proves: when a property has a covering tech (default_assignee_user_id),
 * a new work order on that property is born "assigned", writes an
 * assignment row to that user, and (no-throw) notifies. When the property
 * has no covering tech, the WO falls back to "new" with no assignment.
 *
 * Mirrors work-order-lifecycle.test.ts: mocks Clerk, drives the real server
 * functions against the Neon dev branch under RLS, cleans up after itself.
 * Auto-skipped without DATABASE_URL(_UNPOOLED).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_routing_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_routing_${Date.now()}`;

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({
    userId: TEST_CLERK_USER_ID,
    orgId: TEST_ORG,
    sessionClaims: {},
    actor: null,
    orgRole: "org:admin",
    orgSlug: null,
    has: () => false,
  })),
  currentUser: vi.fn(async () => ({
    id: TEST_CLERK_USER_ID,
    primaryEmailAddress: { emailAddress: "routing-test@stack-os.example" },
    emailAddresses: [{ emailAddress: "routing-test@stack-os.example" }],
    firstName: "Routing",
    lastName: "Test",
  })),
}));

import postgres from "postgres";
import {
  createProperty,
  listStaffUsers,
  setPropertyAssignee,
} from "@/lib/server/properties";
import { createWorkOrder } from "@/lib/server/work-orders";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;

/** Read active assignments for a target under the org's RLS context. */
async function activeAssignments(targetId: string) {
  if (!admin) return [];
  return admin.begin(async (tx) => {
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
    await tx`set local role app_user`;
    return tx`
      select assignee_type, assignee_id
      from assignments
      where org_id = ${TEST_ORG} and target_id = ${targetId} and unassigned_at is null
    `;
  });
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
    await tx`set local role app_user`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from notifications where org_id = ${TEST_ORG}`;
    await tx`delete from assignments where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("auto-assign by property", () => {
  // Higher timeout: this path makes ~20 sequential round-trips to remote Neon
  // (property + user + assignment + audit writes + post-commit notify).
  it("auto-assigns a new WO to the property's covering tech", async () => {
    // createProperty runs ensureUserRow, so the actor exists in users.
    const prop = await createProperty({ name: "Sojo North", city: "Provo", state: "UT" });
    const staff = await listStaffUsers();
    expect(staff.length).toBeGreaterThan(0);
    const techId = staff[0]!.id;

    await setPropertyAssignee(prop.id, techId);

    const wo = await createWorkOrder({
      title: "Suite 204 — water heater leak",
      propertyId: prop.id,
    });

    expect(wo.status).toBe("assigned");
    const rows = await activeAssignments(wo.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.assignee_type).toBe("user");
    expect(rows[0]!.assignee_id).toBe(techId);
  }, 20_000);

  it("leaves a WO 'new' when the property has no covering tech", async () => {
    const prop = await createProperty({ name: "Unrouted Plaza", city: "Provo", state: "UT" });
    const wo = await createWorkOrder({
      title: "Lobby light out",
      propertyId: prop.id,
    });

    expect(wo.status).toBe("new");
    const rows = await activeAssignments(wo.id);
    expect(rows).toHaveLength(0);
  });

  it("leaves a WO 'new' when it has no property at all", async () => {
    const wo = await createWorkOrder({ title: "Untargeted request" });
    expect(wo.status).toBe("new");
    const rows = await activeAssignments(wo.id);
    expect(rows).toHaveLength(0);
  });
});
