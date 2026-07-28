/**
 * Password reset (AUTH-005) — request stores a hashed token; complete sets the
 * new password with a valid token; expired/wrong tokens fail; weak passwords are
 * rejected; a missing email is a silent no-op. Covers staff + tenant (the staff
 * path exercises the users_system_lookup RLS policy). Auto-skipped w/o DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import postgres from "postgres";
import { requestPasswordReset, completePasswordReset } from "@/lib/server/password-reset";
import { verifyTenantCredentials } from "@/lib/server/tenant-credentials";
import { verifyStaffCredentials } from "@/lib/server/credentials";
import { hashToken } from "@/lib/tokens";

const ORG = `org_pwreset_${Date.now()}`;
const T_EMAIL = `resident_${Date.now()}@lucid.test`;
const S_EMAIL = `op_${Date.now()}@stackwithus.com`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { unitId: "", propertyId: "", tenantId: "", staffId: "" };

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
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"HQ"}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"S1"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status) values (${ORG}, ${ids.unitId}, ${T_EMAIL}, ${"Res"}, 'active') returning id`;
    ids.tenantId = t!.id;
    const [s] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${"local:op"+Date.now()}, ${S_EMAIL}, ${"Op"}, 'admin') returning id`;
    ids.staffId = s!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
  });
  await admin.end();
});

/** Plant a known reset token on a row (bypassing the emailed raw token). */
async function plantToken(table: "tenant_users" | "users", id: string, raw: string, expiresAt: Date) {
  const hash = hashToken(raw);
  await admin!.begin(async (tx) => {
    await sys(tx);
    if (table === "tenant_users") {
      await tx`update tenant_users set password_reset_token_hash=${hash}, password_reset_expires_at=${expiresAt} where id=${id}`;
    } else {
      await tx`update users set password_reset_token_hash=${hash}, password_reset_expires_at=${expiresAt} where id=${id}`;
    }
  });
}

describe.skipIf(skip)("password reset", () => {
  it("request stores a hashed token + future expiry (tenant)", async () => {
    await requestPasswordReset("tenant", T_EMAIL);
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ h: string | null; e: Date | null }[]>`select password_reset_token_hash h, password_reset_expires_at e from tenant_users where id=${ids.tenantId}`;
    });
    expect(row!.h).not.toBeNull();
    expect(row!.e && new Date(row!.e).getTime()).toBeGreaterThan(Date.now());
  }, 20_000);

  it("request for a missing email is a silent no-op (no disclosure, no throw)", async () => {
    await expect(requestPasswordReset("tenant", "nobody@nowhere.test")).resolves.toBeUndefined();
  }, 20_000);

  it("complete with a valid token sets the new password (tenant)", async () => {
    const raw = "known-tenant-token-abc";
    await plantToken("tenant_users", ids.tenantId, raw, new Date(Date.now() + 3600_000));
    const r = await completePasswordReset("tenant", raw, "BrandNew-Pass99");
    expect(r.ok).toBe(true);
    // New password now works; token is cleared (can't reuse).
    expect(await verifyTenantCredentials(null, T_EMAIL, "BrandNew-Pass99")).not.toBeNull();
    const again = await completePasswordReset("tenant", raw, "Another-Pass99");
    expect(again.ok).toBe(false); // token consumed
  }, 30_000);

  it("expired and wrong tokens are rejected", async () => {
    await plantToken("tenant_users", ids.tenantId, "expired-tok", new Date(Date.now() - 1000));
    expect((await completePasswordReset("tenant", "expired-tok", "Whatever-Pass99")).error).toBe("invalid_or_expired");
    expect((await completePasswordReset("tenant", "never-issued", "Whatever-Pass99")).error).toBe("invalid_or_expired");
  }, 20_000);

  it("weak passwords are rejected", async () => {
    await plantToken("tenant_users", ids.tenantId, "weak-tok", new Date(Date.now() + 3600_000));
    expect((await completePasswordReset("tenant", "weak-tok", "short")).error).toBe("weak_password");
  }, 20_000);

  it("staff reset works via the users_system_lookup policy", async () => {
    const raw = "known-staff-token-xyz";
    await plantToken("users", ids.staffId, raw, new Date(Date.now() + 3600_000));
    const r = await completePasswordReset("staff", raw, "StaffNew-Pass99");
    expect(r.ok).toBe(true);
    expect(await verifyStaffCredentials(ORG, S_EMAIL, "StaffNew-Pass99")).not.toBeNull();
  }, 30_000);
});
