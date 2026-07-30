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
    await tx`delete from auth_events where org_id = ${ORG} or subject_email like ${"ghost_%@nowhere.test"}`;
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

/** Wipe both fixtures' tokens so a test can assert who a request landed on. */
async function clearTokens() {
  await admin!.begin(async (tx) => {
    await sys(tx);
    await tx`update users set password_reset_token_hash=null, password_reset_expires_at=null where org_id=${ORG}`;
    await tx`update tenant_users set password_reset_token_hash=null, password_reset_expires_at=null where org_id=${ORG}`;
  });
}

/** Did a live (unexpired) reset token land on this row? */
async function tokenOn(table: "tenant_users" | "users", id: string): Promise<boolean> {
  const [row] = await admin!.begin(async (tx) => {
    await sys(tx);
    return table === "users"
      ? tx<{ h: string | null; e: Date | null }[]>`select password_reset_token_hash h, password_reset_expires_at e from users where id=${id}`
      : tx<{ h: string | null; e: Date | null }[]>`select password_reset_token_hash h, password_reset_expires_at e from tenant_users where id=${id}`;
  });
  return !!row?.h && !!row.e && new Date(row.e).getTime() > Date.now();
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
    expect(r.actor).toBe("staff");
    expect(await verifyStaffCredentials(ORG, S_EMAIL, "StaffNew-Pass99")).not.toBeNull();
  }, 30_000);

  /**
   * Wrong-door regression (2026-07-30). A technician opened the *resident*
   * reset page, typed a real staff address, got "a reset link is on its way",
   * and no token was ever issued — the request silently matched nothing and
   * left no audit row, so there was no way to tell it had happened. The reset
   * surface must not decide which table a person is allowed to live in.
   */
  describe("wrong reset surface still reaches the account", () => {
    it("a staff email submitted on the RESIDENT page issues a staff token", async () => {
      await clearTokens();
      await requestPasswordReset("tenant", S_EMAIL); // resident page, staff address
      expect(await tokenOn("users", ids.staffId)).toBe(true);
    }, 30_000);

    it("a resident email submitted on the STAFF page issues a resident token", async () => {
      await clearTokens();
      await requestPasswordReset("staff", T_EMAIL); // ops page, resident address
      expect(await tokenOn("tenant_users", ids.tenantId)).toBe(true);
    }, 30_000);

    it("a staff token opened on the resident page still redeems, and reports staff", async () => {
      const raw = `cross-surface-${Date.now()}`;
      await plantToken("users", ids.staffId, raw, new Date(Date.now() + 3600_000));
      const r = await completePasswordReset("tenant", raw, "CrossDoor-Pass99");
      expect(r.ok).toBe(true);
      expect(r.actor).toBe("staff"); // drives the redirect to /sign-in
      expect(await verifyStaffCredentials(ORG, S_EMAIL, "CrossDoor-Pass99")).not.toBeNull();
    }, 30_000);
  });

  /** An unmatched request stays silent to the caller but must leave a trace —
   *  that absence is what made the original outage undiagnosable. */
  it("an email with no account anywhere records reset_no_match", async () => {
    const missing = `ghost_${Date.now()}@nowhere.test`;
    await requestPasswordReset("staff", missing);
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ n: number }[]>`select count(*)::int n from auth_events where event='reset_no_match' and subject_email=${missing}`;
    });
    expect(row!.n).toBe(1);
  }, 30_000);

  /** A completed reset must not leave the person stuck behind a forced change. */
  it("completing a resident reset clears must_change_password", async () => {
    const raw = `mcp-${Date.now()}`;
    await admin!.begin(async (tx) => {
      await sys(tx);
      await tx`update tenant_users set must_change_password = true where id = ${ids.tenantId}`;
    });
    await plantToken("tenant_users", ids.tenantId, raw, new Date(Date.now() + 3600_000));
    expect((await completePasswordReset("tenant", raw, "NoForcedChange-99")).ok).toBe(true);
    const [row] = await admin!.begin(async (tx) => {
      await sys(tx);
      return tx<{ m: boolean }[]>`select must_change_password m from tenant_users where id=${ids.tenantId}`;
    });
    expect(row!.m).toBe(false);
  }, 30_000);
});
