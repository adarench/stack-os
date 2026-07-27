/**
 * M2 confirmed-defect fixes (ASN-001 tenant auto-assign, MSG-010 tenant-updated
 * stamp). Auto-skipped without DATABASE_URL. Self-managed fixtures.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  createWorkOrderFromTenant,
  createTenantComment,
} from "@/lib/server/tenant-work-orders";
import type { TenantSession } from "@/lib/server/tenant-auth";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

const ORG = `org_m2_${Date.now()}`;
const NS = `m2_${Date.now()}`;
let admin: postgres.Sql | null = null;
const ids = { techId: "", propertyId: "", unitId: "", tenantId: "" };

async function sysScope(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sysScope(tx);
    const [tech] = await tx<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role)
      values (${ORG}, ${"local:" + NS}, ${NS + "+tech@t.test"}, ${"Tech"}, 'technician')
      returning id`;
    ids.techId = tech!.id;
    const [p] = await tx<{ id: string }[]>`
      insert into properties (org_id, name, default_assignee_user_id)
      values (${ORG}, ${"P " + NS}, ${ids.techId}) returning id`;
    ids.propertyId = p!.id;
    const [u] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"2A"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, status)
      values (${ORG}, ${ids.unitId}, ${NS + "+sam@t.test"}, 'active') returning id`;
    ids.tenantId = t!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sysScope(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from audit_log where org_id = ${ORG}`;
    await tx`delete from assignments where org_id = ${ORG}`;
    await tx`delete from comments where org_id = ${ORG}`;
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("M2 tenant defect fixes", () => {
  const session: TenantSession = { orgId: ORG, tenantUserId: "" };
  let woId = "";

  it("ASN-001: a resident-submitted WO auto-assigns the covering technician", async () => {
    session.tenantUserId = ids.tenantId;
    const wo = await createWorkOrderFromTenant(session, {
      category: "hvac",
      title: "AC not cooling",
      priority: "normal",
    });
    woId = wo.id;
    // Status is 'assigned' (not the old ownerless 'new').
    expect(wo.status).toBe("assigned");

    const rows = await admin!.begin(async (tx) => {
      await sysScope(tx);
      return tx<{ assignee_id: string }[]>`
        select assignee_id from assignments
        where org_id = ${ORG} and target_type = 'work_order' and target_id = ${woId}
          and assignee_type = 'user' and unassigned_at is null`;
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.assignee_id).toBe(ids.techId);
  }, 20_000);

  it("MSG-010: a resident message stamps tenantUpdatedAt on the WO", async () => {
    const before = await admin!.begin(async (tx) => {
      await sysScope(tx);
      return tx<{ tenant_updated_at: string | null }[]>`
        select tenant_updated_at from work_orders where id = ${woId}`;
    });
    // Reset to null first to prove the message sets it.
    await admin!.begin(async (tx) => {
      await sysScope(tx);
      await tx`update work_orders set tenant_updated_at = null where id = ${woId}`;
    });

    await createTenantComment(session, { workOrderId: woId, body: "any update?" });

    const after = await admin!.begin(async (tx) => {
      await sysScope(tx);
      return tx<{ tenant_updated_at: string | null }[]>`
        select tenant_updated_at from work_orders where id = ${woId}`;
    });
    expect(after[0]!.tenant_updated_at).not.toBeNull();
    // sanity: the column existed before too
    expect(before.length).toBe(1);
  }, 20_000);
});
