/**
 * READ-ONLY: recent auth activity + accounts that have never signed in.
 *
 *   pnpm dlx tsx scripts/auth-audit.ts [days]
 *
 * Companion to diagnose-account.ts. Use this to spot people who were
 * provisioned but never got in — the failure mode that is otherwise invisible,
 * because a reset request for an unknown email is a deliberate silent no-op.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__dir, "..", "web", ".env"), quiet: true });

const days = Number(process.argv[2] ?? 14);
const sql = postgres(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!, {
  ssl: "require",
  max: 1,
});
const fmt = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 16).replace("T", " ") : "never");

async function main() {
  const events = await sql`
    select event, actor_type, subject_email, ip, meta, created_at
    from auth_events where created_at > now() - (${days} || ' days')::interval
    order by created_at desc limit 100`;
  console.log(`\n=== auth_events, last ${days}d (${events.length}) ===`);
  for (const e of events)
    console.log(
      `  ${fmt(e.created_at)}  ${String(e.event).padEnd(20)} ${String(e.subject_email ?? "—").padEnd(30)}` +
        ` actor=${String(e.actor_type).padEnd(7)} ip=${e.ip ?? "—"} ${e.meta ? JSON.stringify(e.meta) : ""}`,
    );

  const rl = await sql`select key, count, window_start from rate_limits order by window_start desc limit 20`;
  console.log(`\n=== rate_limits (live buckets) ===`);
  if (!rl.length) console.log("  (empty)");
  for (const r of rl) console.log(`  ${String(r.key).padEnd(40)} count=${r.count}  window=${fmt(r.window_start)}`);

  const staff = await sql`
    select email, name, role, status, (password_hash is not null) as pw, must_change_password, created_at
    from users where last_login_at is null order by created_at`;
  console.log(`\n=== STAFF who have NEVER signed in (${staff.length}) ===`);
  for (const r of staff)
    console.log(
      `  ${String(r.email).padEnd(32)} ${String(r.name ?? "").padEnd(20)} role=${String(r.role).padEnd(11)}` +
        ` status=${String(r.status).padEnd(11)} pw=${r.pw ? "yes" : "NO "} added=${fmt(r.created_at)}`,
    );

  const tenants = await sql`
    select email, name, status, (password_hash is not null) as pw, must_change_password, created_at
    from tenant_users where last_signed_in_at is null order by created_at`;
  console.log(`\n=== RESIDENTS who have NEVER signed in (${tenants.length}) ===`);
  for (const r of tenants)
    console.log(
      `  ${String(r.email).padEnd(32)} ${String(r.name ?? "").padEnd(20)} status=${String(r.status).padEnd(9)}` +
        ` pw=${r.pw ? "yes" : "NO "} added=${fmt(r.created_at)}`,
    );

  await sql.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
