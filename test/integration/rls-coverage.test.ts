/**
 * D6 — RLS coverage is enforced from the live schema, not a hand-maintained list.
 * Fails if ANY public table is missing ENABLE/FORCE ROW LEVEL SECURITY or a
 * policy — so a future table added without RLS breaks CI instead of shipping
 * silently writable by `app_user`.
 *
 * D5 — a staff ('user') actor can only see auth_events in its own org.
 *
 * Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const ORG_A = `org_rlscov_a_${Date.now()}`;
const ORG_B = `org_rlscov_b_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', '_', true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`insert into auth_events (org_id, event, actor_type) values (${ORG_A}, 'login_ok', 'user')`;
    await tx`insert into auth_events (org_id, event, actor_type) values (${ORG_B}, 'login_ok', 'user')`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from auth_events where org_id in (${ORG_A}, ${ORG_B})`;
  });
  await admin.end();
});

describe.skipIf(skip)("RLS coverage + auth_events org isolation", () => {
  it("every public table has RLS enabled + forced + ≥1 policy (D6)", async () => {
    const rows = await admin!<{ table: string; enabled: boolean; forced: boolean; policies: number }[]>`
      select c.relname as table,
             c.relrowsecurity as enabled,
             c.relforcerowsecurity as forced,
             (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and c.relname not like '\\_\\_drizzle%'`;
    const bad = rows.filter((r) => !r.enabled || !r.forced || r.policies === 0);
    expect(bad, `public tables missing ENABLE/FORCE RLS or a policy: ${bad.map((b) => b.table).join(", ") || "none"}`).toEqual([]);
    // Sanity: we actually enumerated the schema (guards against an empty match).
    expect(rows.length).toBeGreaterThan(30);
  }, 30_000);

  it("a staff (user) actor only sees auth_events in its own org (D5)", async () => {
    const seen = await admin!.begin(async (tx) => {
      await tx`set local role app_user`;
      await tx`select set_config('app.actor_type', 'user', true)`;
      await tx`select set_config('app.org_id', ${ORG_A}, true)`;
      return tx<{ org_id: string }[]>`select org_id from auth_events where org_id in (${ORG_A}, ${ORG_B})`;
    });
    const orgs = seen.map((r) => r.org_id);
    expect(orgs).toContain(ORG_A); // own org visible
    expect(orgs).not.toContain(ORG_B); // other org's audit rows hidden
  }, 30_000);
});
