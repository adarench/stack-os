/**
 * READ-ONLY: explain why a specific person can or cannot sign in / reset.
 *
 *   pnpm dlx tsx scripts/diagnose-account.ts fernando@stackwithus.com
 *
 * Prints every staff (`users`) and resident (`tenant_users`) row that matches
 * the email, plus the exact reason each row would be rejected by
 * verifyStaffCredentials / verifyTenantCredentials, and whether a live reset
 * token exists. Answers "is it a him thing or an us thing" without guessing.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__dir, "..", "web", ".env"), quiet: true });

const needle = (process.argv[2] ?? "").trim().toLowerCase();
if (!needle) {
  console.error("usage: tsx scripts/diagnose-account.ts <email-or-fragment>");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!, {
  ssl: "require",
  max: 1,
});

const fmt = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 16).replace("T", " ") : "—");

async function main() {
  const like = `%${needle}%`;

  const staff = await sql`
    select id, org_id, email, username, name, role, status,
           (password_hash is not null) as has_pw, must_change_password,
           failed_login_count, locked_until,
           (password_reset_token_hash is not null) as has_reset_token,
           password_reset_expires_at, last_login_at, created_at
    from users where lower(email) like ${like} or lower(coalesce(name,'')) like ${like}
    order by created_at`;

  const tenants = await sql`
    select tu.id, tu.org_id, tu.email, tu.name, tu.unit_id, tu.status,
           (tu.password_hash is not null) as has_pw, tu.must_change_password,
           tu.failed_login_count, tu.locked_until,
           (tu.password_reset_token_hash is not null) as has_reset_token,
           tu.password_reset_expires_at, tu.last_signed_in_at, tu.created_at,
           u.label as unit, p.name as property
    from tenant_users tu
    left join units u on u.id = tu.unit_id
    left join properties p on p.id = u.property_id
    where lower(tu.email) like ${like} or lower(coalesce(tu.name,'')) like ${like}
    order by tu.created_at`;

  console.log(`\n=== "${needle}" → ${staff.length} staff row(s), ${tenants.length} resident row(s) ===`);

  const blockers = (r: Record<string, unknown>, kind: "staff" | "tenant") => {
    const out: string[] = [];
    if (!r.has_pw) out.push("NO PASSWORD SET → every login fails");
    if (kind === "staff" && r.status !== "active") out.push(`status=${r.status} → login blocked`);
    if (kind === "tenant" && r.status === "revoked") out.push("status=revoked → login blocked");
    if (r.locked_until && new Date(r.locked_until as string) > new Date())
      out.push(`LOCKED OUT until ${fmt(r.locked_until)} (${r.failed_login_count} failed attempts)`);
    if (r.must_change_password) out.push("must_change_password → forced to /change-password after login");
    if (r.has_reset_token) {
      const live = r.password_reset_expires_at && new Date(r.password_reset_expires_at as string) > new Date();
      out.push(live ? `reset token LIVE until ${fmt(r.password_reset_expires_at)}` : "reset token EXPIRED");
    }
    return out;
  };

  for (const r of staff) {
    console.log(
      `\n[staff]  ${r.email}  (${r.name ?? "no name"})  role=${r.role}  id=${r.id}` +
        `\n         org=${r.org_id}  username=${r.username ?? "—"}  created=${fmt(r.created_at)}  last_login=${fmt(r.last_login_at)}`,
    );
    const b = blockers(r as Record<string, unknown>, "staff");
    console.log(b.length ? b.map((x) => `         ⚠ ${x}`).join("\n") : "         ✓ can sign in at /sign-in");
  }

  for (const r of tenants) {
    console.log(
      `\n[resident] ${r.email}  (${r.name ?? "no name"})  id=${r.id}` +
        `\n         org=${r.org_id}  unit=${r.property ?? "?"} / ${r.unit ?? "NO UNIT"}  created=${fmt(r.created_at)}  last_login=${fmt(r.last_signed_in_at)}`,
    );
    const b = blockers(r as Record<string, unknown>, "tenant");
    console.log(b.length ? b.map((x) => `         ⚠ ${x}`).join("\n") : "         ✓ can sign in at /tenant/sign-in");
  }

  if (staff.length === 0 && tenants.length === 0) {
    console.log("\n  ✗ NO ACCOUNT ANYWHERE. /forgot and /tenant/forgot will both silently say");
    console.log("    'check your email' and send nothing. This person must be added first.");
  }
  // Only exact-email collisions are real duplicates — a fragment like
  // "stackwithus" matches several different people, which is not a problem.
  const dupes = (rows: readonly Record<string, unknown>[], label: string) => {
    const byEmail = new Map<string, number>();
    for (const r of rows) {
      const k = String(r.email).toLowerCase();
      byEmail.set(k, (byEmail.get(k) ?? 0) + 1);
    }
    for (const [email, n] of byEmail)
      if (n > 1) console.log(`\n  ✗ ${n} DUPLICATE ${label} rows for ${email} — reset and login can target different rows.`);
  };
  dupes(staff as Record<string, unknown>[], "staff");
  dupes(tenants as Record<string, unknown>[], "resident");

  const shared = new Set(staff.map((r) => String(r.email).toLowerCase())).intersection(
    new Set(tenants.map((r) => String(r.email).toLowerCase())),
  );
  for (const email of shared)
    console.log(`\n  ! SPLIT IDENTITY: ${email} exists as BOTH staff and resident. A reset resolves to\n    the staff row first; the resident password is unchanged.`);

  const ids = [...staff.map((r) => r.id as string), ...tenants.map((r) => r.id as string)];
  const events = await sql`
    select event, actor_type, subject_email, ip, meta, created_at
    from auth_events
    where lower(coalesce(subject_email,'')) like ${like}
       or (${ids.length > 0} and (subject_user_id::text = any(${ids}) or subject_tenant_user_id::text = any(${ids})))
    order by created_at desc limit 40`;
  console.log(`\n=== auth_events (most recent 40) ===`);
  if (!events.length) console.log("  (none — this person has never triggered a login, reset, or invite)");
  for (const e of events) {
    console.log(
      `  ${fmt(e.created_at)}  ${String(e.event).padEnd(20)} actor=${String(e.actor_type).padEnd(7)}` +
        ` ip=${e.ip ?? "—"} ${e.meta ? JSON.stringify(e.meta) : ""}`,
    );
  }

  await sql.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
