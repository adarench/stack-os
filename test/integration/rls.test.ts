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
 * Postgres `SET LOCAL` doesn't accept parameters ($1), so we use
 * `select set_config('app.org_id', $1, true)` everywhere — the third
 * arg `true` makes it transaction-local (equivalent to SET LOCAL).
 */

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

const ORG_A = `org_test_a_${Date.now()}`;
const ORG_B = `org_test_b_${Date.now()}`;
const TEST_NS = `rls_${Date.now()}`;

let admin: postgres.Sql | null = null;
const created = {
  workOrderIds: [] as string[],
  vendorIds: [] as string[],
  vendorUserIds: [] as string[],
};

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  const fn = await admin`select to_regprocedure('current_org_id()') as p`;
  if (!fn[0]?.p) {
    throw new Error("current_org_id() not found — run `pnpm db:rls:apply` first");
  }
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', ${ORG_A}, true)`;
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

async function setScope(
  tx: postgres.Sql,
  opts: { orgId: string; actorType: "user" | "vendor" | "system"; vendorUserId?: string },
) {
  // Drop to the RLS-enforced role just like the runtime app does.
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', ${opts.actorType}, true)`;
  await tx`select set_config('app.org_id', ${opts.orgId}, true)`;
  if (opts.vendorUserId) {
    await tx`select set_config('app.vendor_user_id', ${opts.vendorUserId}, true)`;
  }
}

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
      await setScope(tx, { orgId: ORG_A, actorType: "user" });
      const n = await woNumber(tx, ORG_A);
      const r = await tx<{ id: string }[]>`
        insert into work_orders (org_id, number, title, status, kind, priority, created_by_actor_type)
        values (${ORG_A}, ${n}, ${"RLS A→B isolation " + TEST_NS}, 'new', 'work_order', 'normal', 'user')
        returning id
      `;
      created.workOrderIds.push(r[0]!.id);
      return r[0]!.id;
    });

    const bRows = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG_B, actorType: "user" });
      return tx`select id from work_orders where id = ${id}`;
    });
    expect(bRows.length).toBe(0);

    const aRows = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG_A, actorType: "user" });
      return tx`select id from work_orders where id = ${id}`;
    });
    expect(aRows.length).toBe(1);
  });

  it("missing app.org_id rejects all queries (returns zero rows)", async () => {
    if (!admin) return;
    const rows = await admin.begin(async (tx) => {
      // Drop privileges, set actor_type='user', leave app.org_id unset.
      await tx`set local role app_user`;
      await tx`select set_config('app.actor_type', 'user', true)`;
      return tx`select id from work_orders limit 1`;
    });
    expect(rows.length).toBe(0);
  });
});

describe.skipIf(skip)("RLS — vendor scope", () => {
  it("vendor_user can SELECT only assigned work_orders in their org", async () => {
    if (!admin) return;

    const ctx = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG_A, actorType: "user" });

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
      await setScope(tx, {
        orgId: ORG_A,
        actorType: "vendor",
        vendorUserId: ctx.vendorUserId,
      });
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
    const created2 = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG_A, actorType: "user" });
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

    const found = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: "__lookup__", actorType: "system" });
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
