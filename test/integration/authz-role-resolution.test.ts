/**
 * Authz — role resolution for OAuth sessions (SEC-002/003 regression).
 *
 * Credential logins embed the role in the session; Google/OAuth logins do not.
 * `resolveStaffRole` must read the role from the DB by subject OR email so the
 * console gate (hasConsoleAccess) decides correctly: staff resolved from the DB
 * are allowed (technicians included, LR-014) and an unknown session is not.
 * Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { resolveStaffRole } from "@/lib/server/credentials";
import { hasConsoleAccess, isOperatorRole } from "@/lib/server/roles";

const ORG = `org_authz_${Date.now()}`;
const OP_SUBJECT = `oauth:${Date.now()}`; // an OAuth-style subject, no embedded role
const OP_EMAIL = `op_${Date.now()}@stackwithus.com`;
const TECH_SUBJECT = `local:${Date.now()}`;
const TECH_EMAIL = `tech_${Date.now()}@stackwithus.com`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;

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
    await tx`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_SUBJECT}, ${OP_EMAIL}, ${"Op"}, 'admin')`;
    await tx`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${TECH_SUBJECT}, ${TECH_EMAIL}, ${"Tech"}, 'technician')`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("authz role resolution (OAuth sessions)", () => {
  it("resolves an operator role by subject → gate allows", async () => {
    const role = await resolveStaffRole(ORG, OP_SUBJECT, null);
    expect(role).toBe("admin");
    expect(hasConsoleAccess(role)).toBe(true);
  }, 30_000);

  it("resolves by email when the subject doesn't match (OAuth id ≠ stored subject)", async () => {
    const role = await resolveStaffRole(ORG, "oauth:some-other-google-id", OP_EMAIL);
    expect(role).toBe("admin");
    expect(hasConsoleAccess(role)).toBe(true);
  }, 30_000);

  it("resolves a technician → same console access as an admin (LR-014)", async () => {
    const role = await resolveStaffRole(ORG, TECH_SUBJECT, TECH_EMAIL);
    expect(role).toBe("technician");
    expect(hasConsoleAccess(role)).toBe(true);
    // Still off the ops-desk notify list — that's fan-out, not access.
    expect(isOperatorRole(role)).toBe(false);
  }, 30_000);

  it("returns null for an unknown session → gate blocks", async () => {
    const role = await resolveStaffRole(ORG, "oauth:nobody", "nobody@nowhere.test");
    expect(role).toBeNull();
    expect(hasConsoleAccess(role)).toBe(false);
  }, 30_000);
});
