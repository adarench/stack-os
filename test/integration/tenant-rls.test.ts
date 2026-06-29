import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { dispatchInline } from "@/lib/server/notifications";

/**
 * Tenant-app RLS + resolution integration tests. Self-managed fixtures (own
 * test org), cleaned up in afterAll. Verifies the security model the tenant
 * app depends on:
 *   - a resident reads only their own unit's WO / external comments / photos
 *   - a different unit's resident is fully isolated
 *   - internal comments NEVER reach a tenant
 *   - the confirm transition (system-scope privileged write) lands + audits
 *
 * Setup: pnpm db:migrate (schema + RLS).
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

const ORG = `org_tenant_rls_${Date.now()}`;
const NS = `trls_${Date.now()}`;

let admin: postgres.Sql | null = null;
const ids = {
  propertyId: "",
  unit1: "",
  unit2: "",
  tenant1: "",
  tenant2: "",
  woId: "",
};

async function setScope(
  tx: postgres.Sql,
  opts: {
    orgId: string;
    actorType: "user" | "tenant" | "system";
    tenantUserId?: string;
  },
) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', ${opts.actorType}, true)`;
  await tx`select set_config('app.org_id', ${opts.orgId}, true)`;
  if (opts.tenantUserId) {
    await tx`select set_config('app.tenant_user_id', ${opts.tenantUserId}, true)`;
  }
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await setScope(tx, { orgId: ORG, actorType: "user" });
    const [p] = await tx<{ id: string }[]>`
      insert into properties (org_id, name) values (${ORG}, ${"P " + NS}) returning id`;
    ids.propertyId = p!.id;
    const [u1] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"1A"}) returning id`;
    ids.unit1 = u1!.id;
    const [u2] = await tx<{ id: string }[]>`
      insert into units (org_id, property_id, label) values (${ORG}, ${ids.propertyId}, ${"1B"}) returning id`;
    ids.unit2 = u2!.id;
    const [t1] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, status) values (${ORG}, ${ids.unit1}, ${NS + "+1@t.test"}, ${"active"}) returning id`;
    ids.tenant1 = t1!.id;
    const [t2] = await tx<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, status) values (${ORG}, ${ids.unit2}, ${NS + "+2@t.test"}, ${"active"}) returning id`;
    ids.tenant2 = t2!.id;
    const [wo] = await tx<{ id: string }[]>`
      insert into work_orders (org_id, number, title, status, kind, priority, unit_id, property_id, created_by_actor_type, created_by_tenant_user_id)
      values (${ORG}, 1, ${"Leak " + NS}, 'resolved', 'work_order', 'normal', ${ids.unit1}, ${ids.propertyId}, 'tenant', ${ids.tenant1})
      returning id`;
    ids.woId = wo!.id;
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, visibility)
      values (${ORG}, 'work_order', ${ids.woId}, ${"external hello"}, 'user', 'external')`;
    await tx`insert into comments (org_id, target_type, target_id, body, actor_type, visibility)
      values (${ORG}, 'work_order', ${ids.woId}, ${"internal secret"}, 'user', 'internal')`;
    await tx`insert into attachments (org_id, target_type, target_id, kind, storage_key, content_type, uploaded_by_actor_type)
      values (${ORG}, 'work_order', ${ids.woId}, 'before_photo', ${ORG + "/k"}, ${"image/jpeg"}, 'tenant')`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await setScope(tx, { orgId: ORG, actorType: "system" });
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from audit_log where org_id = ${ORG}`;
    await tx`delete from comments where org_id = ${ORG}`;
    await tx`delete from attachments where org_id = ${ORG}`;
    await tx`delete from work_orders where org_id = ${ORG}`;
    await tx`delete from tenant_users where org_id = ${ORG}`;
    await tx`delete from units where org_id = ${ORG}`;
    await tx`delete from properties where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("tenant RLS", () => {
  it("resident reads their own unit's WO; a different unit's resident cannot", async () => {
    if (!admin) return;
    const own = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "tenant", tenantUserId: ids.tenant1 });
      return tx`select id from work_orders where id = ${ids.woId}`;
    });
    expect(own.length).toBe(1);

    const other = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "tenant", tenantUserId: ids.tenant2 });
      return tx`select id from work_orders where id = ${ids.woId}`;
    });
    expect(other.length).toBe(0);
  });

  it("resident reads external comments but NEVER internal ones", async () => {
    if (!admin) return;
    const rows = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "tenant", tenantUserId: ids.tenant1 });
      return tx<{ body: string; visibility: string }[]>`
        select body, visibility from comments where target_id = ${ids.woId}`;
    });
    expect(rows.length).toBe(1);
    expect(rows[0]!.visibility).toBe("external");
  });

  it("resident reads photos on their own WO; other unit cannot", async () => {
    if (!admin) return;
    const own = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "tenant", tenantUserId: ids.tenant1 });
      return tx`select id from attachments where target_id = ${ids.woId}`;
    });
    expect(own.length).toBe(1);
    const other = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "tenant", tenantUserId: ids.tenant2 });
      return tx`select id from attachments where target_id = ${ids.woId}`;
    });
    expect(other.length).toBe(0);
  });

  it("confirm transition (system-scope write) lands resolved → verified", async () => {
    if (!admin) return;
    await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "system" });
      await tx`update work_orders set status = 'verified' where id = ${ids.woId}`;
      await tx`insert into audit_log (org_id, target_type, target_id, action, actor_type)
        values (${ORG}, 'work_order', ${ids.woId}, 'tenant_confirmed_resolved', 'tenant')`;
    });
    const seen = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "tenant", tenantUserId: ids.tenant1 });
      return tx<{ status: string }[]>`select status from work_orders where id = ${ids.woId}`;
    });
    expect(seen[0]!.status).toBe("verified");
  });

  it("a notification routes to recipient_tenant_user_id (in-app)", async () => {
    if (!admin) return;
    // in-app only (no email/phone) so nothing real sends; records a row.
    await dispatchInline({
      orgId: ORG,
      recipientTenantUserId: ids.tenant1,
      kind: "wo_status",
      subject: "Update on your request",
      body: "Scheduled for this week.",
      targetType: "work_order",
      targetId: ids.woId,
    });
    const rows = await admin.begin(async (tx) => {
      await setScope(tx, { orgId: ORG, actorType: "system" });
      return tx<{ channel: string }[]>`
        select channel from notifications where recipient_tenant_user_id = ${ids.tenant1}`;
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.channel === "in_app")).toBe(true);
  });
});
