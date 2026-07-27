/**
 * Credential-auth integration test (M1 · AUTH-001/002/004/008, SEC-002/003).
 * Auto-skipped without DATABASE_URL. Requires migration 0014 applied.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  provisionStaffAccount,
  verifyStaffCredentials,
  loadStaffRole,
} from "@/lib/server/credentials";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

const TEST_ORG = `org_test_cred_${Date.now()}`;
const PW = "correct-horse-battery-staple";
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
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("credential auth", () => {
  let samId: string;

  it("provisions an account and logs in by email or username", async () => {
    samId = await provisionStaffAccount(TEST_ORG, {
      email: "sam@lucid.test",
      name: "Sam",
      username: "sam",
      role: "technician",
      password: PW,
    });
    expect(samId).toBeTruthy();

    const byEmail = await verifyStaffCredentials(TEST_ORG, "sam@lucid.test", PW);
    expect(byEmail).not.toBeNull();
    expect(byEmail!.role).toBe("technician");
    expect(byEmail!.usersId).toBe(samId);

    const byUsername = await verifyStaffCredentials(TEST_ORG, "SAM", PW);
    expect(byUsername).not.toBeNull();
    expect(byUsername!.usersId).toBe(samId);
  }, 20_000);

  it("rejects wrong password and unknown account identically (no disclosure)", async () => {
    expect(await verifyStaffCredentials(TEST_ORG, "sam@lucid.test", "wrong-password-000")).toBeNull();
    expect(await verifyStaffCredentials(TEST_ORG, "nobody@lucid.test", "wrong-password-000")).toBeNull();
    // A correct login still works afterwards (single failure < lockout threshold).
    expect(await verifyStaffCredentials(TEST_ORG, "sam@lucid.test", PW)).not.toBeNull();
  }, 20_000);

  it("locks an account after 5 consecutive failures", async () => {
    const email = "lockme@lucid.test";
    await provisionStaffAccount(TEST_ORG, { email, role: "staff", password: "right-password-lock" });
    for (let i = 0; i < 5; i++) {
      expect(await verifyStaffCredentials(TEST_ORG, email, "bad-guess")).toBeNull();
    }
    // Even the correct password fails while locked.
    expect(await verifyStaffCredentials(TEST_ORG, email, "right-password-lock")).toBeNull();
  }, 30_000);

  it("blocks a deactivated account", async () => {
    if (!admin) return;
    const email = "gone@lucid.test";
    const id = await provisionStaffAccount(TEST_ORG, { email, role: "staff", password: "good-password-gone" });
    await admin.begin(async (tx) => {
      await tx`select set_config('app.actor_type', 'system', true)`;
      await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
      await tx`set local role app_user`;
      await tx`update users set status = 'deactivated' where id = ${id}`;
    });
    expect(await verifyStaffCredentials(TEST_ORG, email, "good-password-gone")).toBeNull();
  }, 20_000);

  it("is org-scoped — credentials never work under a different org", async () => {
    const other = await verifyStaffCredentials(`org_test_other_${Date.now()}`, "sam@lucid.test", PW);
    expect(other).toBeNull();
  }, 20_000);

  it("loadStaffRole returns the account role (RBAC read)", async () => {
    const u = await verifyStaffCredentials(TEST_ORG, "sam@lucid.test", PW);
    expect(u).not.toBeNull();
    expect(await loadStaffRole(TEST_ORG, u!.subject)).toBe("technician");
  }, 20_000);
});
