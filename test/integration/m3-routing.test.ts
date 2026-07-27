/**
 * M3 routing + commercial model (ASN-003/008 org fallback; tenant_companies RLS).
 * Auto-skipped without DATABASE_URL. Requires migration 0015.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createWorkOrderFromTenant } from "@/lib/server/tenant-work-orders";
import type { TenantSession } from "@/lib/server/tenant-auth";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

const ORG = `org_m3_${Date.now()}`;
const OTHER_ORG = `org_m3_other_${Date.now()}`;
const NS = `m3_${Date.now()}`;
let admin: postgres.Sql | null = null;
const ids = { fallbackTech: "", propertyId: "", unitId: "", tenantId: "", companyId: "" };

async function sysScope(tx: postgres.Sql, org = ORG) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${org}, true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sysScope(tx);
    const [tech] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${ORG}, ${"local:" + NS}, ${NS + "+fb@t.test"}, ${"Fallback Tech"}, 'technician') returning id`;
    ids.fallbackTech = tech!.id;
    // Property with NO default_assignee — so property routing yields nothing.
    const [p] = await tx<{ id: string }[]>`
      insert into properties (org_id, name) values (${ORG}, ${"P " + NS}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label, floor, suite)
      values (${ORG}, ${ids.propertyId}, ${"Suite 100"}, ${"1"}, ${"100"}) returning id`;
    ids.unitId = u!.id;
    const [company] = await tx<{ id: string }[]>`
      insert into tenant_companies (org_id, name) values (${ORG}, ${"Lucid " + NS}) returning id`;
    ids.companyId = company!.id;
    const [t] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, company_id, email, status)
      values (${ORG}, ${ids.unitId}, ${ids.companyId}, ${NS + "+sam@t.test"}, 'active') returning id`;
    ids.tenantId = t!.id;
    // Configure the org-level fallback assignee.
    await tx`insert into org_settings (org_id, fallback_assignee_user_id) values (${ORG}, ${ids.fallbackTech})`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sysScope(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from audit_log where org_id = ${ORG}`;
    await tx`delete from assignments where org_id = ${ORG}`;
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from org_settings where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from tenant_companies where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("M3 routing + commercial model", () => {
  it("ASN-003/008: falls back to the org assignee when no property tech is set", async () => {
    const session: TenantSession = { orgId: ORG, tenantUserId: ids.tenantId };
    const wo = await createWorkOrderFromTenant(session, {
      category: "hvac",
      title: "AC not cooling — Suite 100",
      priority: "normal",
    });
    expect(wo.status).toBe("assigned"); // not left unassigned

    const rows = await admin!.begin(async (tx) => {
      await sysScope(tx);
      return tx<{ assignee_id: string }[]>`
        select assignee_id from assignments
        where org_id = ${ORG} and target_id = ${wo.id} and unassigned_at is null`;
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.assignee_id).toBe(ids.fallbackTech);

    // Audit records the routing reason.
    const audit = await admin!.begin(async (tx) => {
      await sysScope(tx);
      return tx<{ diff: unknown }[]>`
        select diff from audit_log
        where org_id = ${ORG} and target_id = ${wo.id} and action = 'auto_assigned' limit 1`;
    });
    expect(audit.length).toBe(1);
    expect(JSON.stringify(audit[0]!.diff)).toContain("org_fallback");
  }, 20_000);

  it("tenant_companies is org-scoped (RLS isolation)", async () => {
    const inOrg = await admin!.begin(async (tx) => {
      await sysScope(tx, ORG);
      return tx`select id from tenant_companies where id = ${ids.companyId}`;
    });
    expect(inOrg.length).toBe(1);

    const crossOrg = await admin!.begin(async (tx) => {
      await sysScope(tx, OTHER_ORG);
      return tx`select id from tenant_companies where id = ${ids.companyId}`;
    });
    expect(crossOrg.length).toBe(0); // RLS blocks cross-org read
  }, 20_000);
});
