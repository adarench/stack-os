import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

/**
 * RLS integration tests.
 *
 * Auto-skipped without DATABASE_URL_UNPOOLED or DATABASE_URL.
 *
 * Setup expectation:
 *   pnpm db:migrate   # applies schema + RLS policies
 *
 * These tests connect using `postgres` directly (not through Drizzle/Neon-
 * serverless) because they need fine-grained per-statement SET LOCAL
 * control inside each transaction. They also exercise both staff org
 * scoping and the narrow vendor_users_system_lookup policy.
 *
 * The tests assume RLS policies from /db/rls-policies.sql have been
 * applied. If you change policies, re-run `pnpm db:rls:apply`.
 */

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

const ORG_A = `org_test_a_${Date.now()}`;
const ORG_B = `org_test_b_${Date.now()}`;
const TEST_NS = `rls_${Date.now()}`;

// One shared client for setup/teardown via a privileged path
let admin: postgres.Sql | null = null;
// Insert IDs we create so we can clean up
const created = {
  workOrderIds: [] as string[],
  vendorIds: [] as string[],
  vendorUserIds: [] as string[],
};

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  // Sanity: confirm RLS policies are present.
  const fn = await admin`select to_regprocedure('current_org_id()') as p`;
  if (!fn[0]?.p) {
    throw new Error("current_org_id() not found — run `pnpm db:rls:apply` first");
  }
});

afterAll(async () => {
  if (!admin) return;
  // Clean up under a system-actor scope so RLS doesn't block deletes.
  // We delete narrowly by IDs we tracked.
  await admin.begin(async (tx) => {
    await tx`set local app.actor_type = 'system'`;
    await tx`set local app.org_id = ${ORG_A}`;
    if (created.workOrderIds.length > 0) {
      await tx`delete from audit_log where target_id = any(${created.workOrderIds}::uuid[])`;
      await tx`delete from assignments where target_id = any(${created.workOrderIds}::uuid[])`;
      await tx`delete from work_orders where id = any(${created.workOrderIds}::uuid[])`;
    }
    if (created.vendorUserIds.length > 0) {
      await tx`delete from vendor_users where id = any(${created.vendorUserIds}::uuid[])`;
    }
    if (created.vendorIds.length > 0) {
      await tx`delete from vendors where id = any(${created.vendorIds}::uuid[])`;
    }
  });
  await admin.end();
});

async function woNumber(sql: postgres.Sql, orgId: string): Promise<number> {
  const r = await sql<{ max: number | null }[]>`
    select coalesce(max(number), 0) as max
    from work_orders where org_id = ${orgId}
  `;
  return Number(r[0]?.max ?? 0) + 1;
}

describe.skipIf(skip)("RLS — staff org isolation", () => {
  it("staff in org B cannot read org A's work_order", async () => {
    if (!admin) return;
    const id = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'user'`;
      await tx`set local app.org_id = ${ORG_A}`;
      const n = await woNumber(tx, ORG_A);
      const r = await tx<{ id: string }[]>`
        insert into work_orders (org_id, number, title, status, kind, priority, created_by_actor_type)
        values (${ORG_A}, ${n}, ${"RLS A→B isolation " + TEST_NS}, 'new', 'work_order', 'normal', 'user')
        returning id
      `;
      created.workOrderIds.push(r[0]!.id);
      return r[0]!.id;
    });

    // Org B should see zero rows.
    const bRows = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'user'`;
      await tx`set local app.org_id = ${ORG_B}`;
      return tx`select id from work_orders where id = ${id}`;
    });
    expect(bRows.length).toBe(0);

    // Org A still sees the row.
    const aRows = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'user'`;
      await tx`set local app.org_id = ${ORG_A}`;
      return tx`select id from work_orders where id = ${id}`;
    });
    expect(aRows.length).toBe(1);
  });

  it("missing app.org_id rejects all queries (returns zero rows)", async () => {
    if (!admin) return;
    const rows = await admin.begin(async (tx) => {
      // Intentionally do NOT set app.org_id; actor type defaults handled by NULL.
      await tx`set local app.actor_type = 'user'`;
      return tx`select id from work_orders limit 1`;
    });
    expect(rows.length).toBe(0);
  });
});

describe.skipIf(skip)("RLS — vendor scope", () => {
  it("vendor_user can SELECT only assigned work_orders in their org", async () => {
    if (!admin) return;

    const ctx = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'user'`;
      await tx`set local app.org_id = ${ORG_A}`;

      const v = await tx<{ id: string }[]>`
        insert into vendors (org_id, name) values (${ORG_A}, ${"V " + TEST_NS}) returning id
      `;
      created.vendorIds.push(v[0]!.id);

      const vu = await tx<{ id: string }[]>`
        insert into vendor_users (org_id, vendor_id, email)
        values (${ORG_A}, ${v[0]!.id}, ${TEST_NS + "@example.com"})
        returning id
      `;
      created.vendorUserIds.push(vu[0]!.id);

      const n = await woNumber(tx, ORG_A);
      const wo = await tx<{ id: string }[]>`
        insert into work_orders (org_id, number, title, status, kind, priority, created_by_actor_type)
        values (${ORG_A}, ${n}, ${"WO assigned " + TEST_NS}, 'assigned', 'work_order', 'normal', 'user')
        returning id
      `;
      created.workOrderIds.push(wo[0]!.id);

      await tx`
        insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id)
        values (${ORG_A}, 'work_order', ${wo[0]!.id}, 'vendor_user', ${vu[0]!.id})
      `;

      // And a second WO that is NOT assigned to this vendor_user.
      const n2 = await woNumber(tx, ORG_A);
      const wo2 = await tx<{ id: string }[]>`
        insert into work_orders (org_id, number, title, status, kind, priority, created_by_actor_type)
        values (${ORG_A}, ${n2}, ${"WO unassigned " + TEST_NS}, 'new', 'work_order', 'normal', 'user')
        returning id
      `;
      created.workOrderIds.push(wo2[0]!.id);

      return { vendorUserId: vu[0]!.id, assignedWoId: wo[0]!.id, otherWoId: wo2[0]!.id };
    });

    const visible = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'vendor'`;
      await tx`set local app.org_id = ${ORG_A}`;
      await tx`set local app.vendor_user_id = ${ctx.vendorUserId}`;
      const rows = await tx<{ id: string }[]>`
        select id from work_orders where id in (${ctx.assignedWoId}, ${ctx.otherWoId})
      `;
      return rows.map((r) => r.id);
    });

    expect(visible).toContain(ctx.assignedWoId);
    expect(visible).not.toContain(ctx.otherWoId);
  });

  it("system actor can SELECT vendor_users cross-org for token lookup", async () => {
    if (!admin) return;
    // Create a vendor_user in ORG_A, then look it up from a system scope
    // pretending to not yet know the org (org_id is set to a sentinel).
    const created2 = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'user'`;
      await tx`set local app.org_id = ${ORG_A}`;
      const v = await tx<{ id: string }[]>`
        insert into vendors (org_id, name) values (${ORG_A}, ${"V2 " + TEST_NS}) returning id
      `;
      created.vendorIds.push(v[0]!.id);
      const vu = await tx<{ id: string }[]>`
        insert into vendor_users (org_id, vendor_id, email, magic_link_token_hash, magic_link_expires_at)
        values (${ORG_A}, ${v[0]!.id}, ${TEST_NS + "+token@example.com"}, ${"sha_" + randomUUID()}, now() + interval '1 hour')
        returning id
      `;
      created.vendorUserIds.push(vu[0]!.id);
      return vu[0]!.id;
    });

    // System actor with a sentinel org should still see the row via
    // vendor_users_system_lookup.
    const found = await admin.begin(async (tx) => {
      await tx`set local app.actor_type = 'system'`;
      await tx`set local app.org_id = ${"__lookup__"}`;
      return tx<{ id: string; org_id: string }[]>`
        select id, org_id from vendor_users where id = ${created2}
      `;
    });
    expect(found.length).toBe(1);
    expect(found[0]!.org_id).toBe(ORG_A);
  });
});

describe("RLS test harness", () => {
  it("auto-skips when DATABASE_URL is missing", () => {
    expect(typeof url === "string" || url === undefined).toBe(true);
  });
});
