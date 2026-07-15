/**
 * Saved-views integration test — exercises the exact server functions the
 * /work UI calls (create / list / pin / delete) against the real DB, including
 * per-user isolation. Auto-skipped without DATABASE_URL.
 *
 * Doubles as a live check that migration 0013 (saved_views + RLS) is applied:
 * if the table were missing, createSavedView would throw.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_sv_${Date.now()}`;
const TEST_USER_A = `user_test_sv_a_${Date.now()}`;
const TEST_USER_B = `user_test_sv_b_${Date.now()}`;

// Mutable current user so we can prove per-user scoping through the same mock.
let currentUser = TEST_USER_A;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: currentUser,
    orgId: TEST_ORG,
    email: `${currentUser}@stack-os.example`,
    name: "SV Test",
  })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import {
  listSavedViews,
  createSavedView,
  togglePinSavedView,
  deleteSavedView,
} from "@/lib/server/saved-views";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;

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
    await tx`delete from saved_views where org_id = ${TEST_ORG}`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("saved views", () => {
  it("creates a view and reads it back", async () => {
    currentUser = TEST_USER_A;
    const id = await createSavedView({
      name: "Blocked only",
      params: "status=blocked",
      pinned: true,
    });
    expect(id).toBeTruthy();
    const found = (await listSavedViews()).find((v) => v.id === id);
    expect(found?.name).toBe("Blocked only");
    expect(found?.params).toBe("status=blocked");
    expect(found?.pinned).toBe(true);
  });

  it("toggles pin state", async () => {
    currentUser = TEST_USER_A;
    const id = await createSavedView({ name: "Aging", params: "aging=1", pinned: true });
    await togglePinSavedView(id);
    expect((await listSavedViews()).find((v) => v.id === id)?.pinned).toBe(false);
    await togglePinSavedView(id);
    expect((await listSavedViews()).find((v) => v.id === id)?.pinned).toBe(true);
  });

  it("sorts pinned views ahead of unpinned", async () => {
    currentUser = TEST_USER_A;
    const unpinnedId = await createSavedView({ name: "Unpinned", params: "q=x", pinned: false });
    const views = await listSavedViews();
    const firstPinned = views.findIndex((v) => v.pinned);
    const unpinnedIdx = views.findIndex((v) => v.id === unpinnedId);
    expect(firstPinned).toBeGreaterThanOrEqual(0);
    expect(firstPinned).toBeLessThan(unpinnedIdx);
  });

  it("scopes views to the owning user", async () => {
    currentUser = TEST_USER_A;
    expect((await listSavedViews()).length).toBeGreaterThan(0);

    currentUser = TEST_USER_B;
    expect((await listSavedViews()).length).toBe(0); // B sees none of A's
    const bId = await createSavedView({ name: "B view", params: "mine=mine", pinned: true });
    expect((await listSavedViews()).some((v) => v.id === bId)).toBe(true);

    currentUser = TEST_USER_A;
    expect((await listSavedViews()).some((v) => v.id === bId)).toBe(false); // A can't see B's
  });

  it("deletes a view", async () => {
    currentUser = TEST_USER_A;
    const id = await createSavedView({ name: "Temp", params: "type=prj", pinned: true });
    expect((await listSavedViews()).some((v) => v.id === id)).toBe(true);
    await deleteSavedView(id);
    expect((await listSavedViews()).some((v) => v.id === id)).toBe(false);
  });
});
