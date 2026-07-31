/**
 * Notification matrix — the "right people get the right messages" guarantee as
 * tenants are added. For a resident-submitted WO the system must:
 *   • route to the covering tech of THAT tenant's building (never another
 *     building's tech),
 *   • broadcast to every internal ops role (staff/dispatcher/manager/admin) —
 *     and NOT to technicians,
 *   • confirm to the submitting resident,
 *   • fall back to the org fallback tech when a building has no coverage
 *     (so a newly-added building never lands a resident's WO unassigned).
 * Real dispatch, stubbed transports. Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createWorkOrderFromTenant } from "@/lib/server/tenant-work-orders";

const ORG = `org_matrix_${Date.now()}`;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;

// Roster: 4 internal ops roles + 2 techs. Techs must never be on the broadcast.
const ids = {
  admin: "", dispatcher: "", manager: "", staff: "",
  techA: "", techB: "",
  bldgA: "", bldgB: "", bldgC: "",
  unitA: "", unitB: "", unitC: "",
  tenantA: "", tenantB: "", tenantC: "",
};
const OPS_KEYS = ["admin", "dispatcher", "manager", "staff"] as const;

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}
async function mkUser(tx: postgres.Sql, clerk: string, name: string, role: string, phone: string | null) {
  const [u] = await tx<{ id: string }[]>`
    insert into users (org_id, clerk_user_id, email, name, role, phone)
    values (${ORG}, ${clerk}, ${`${clerk}@x.test`}, ${name}, ${role}, ${phone}) returning id`;
  return u!.id;
}
/** Distinct staff + tenant recipients of any notification on a WO. */
async function recipientsOf(woId: string) {
  const rows = await admin!.begin(async (tx) => {
    await sys(tx);
    return tx<{ u: string | null; t: string | null; kind: string }[]>`
      select recipient_user_id as u, recipient_tenant_user_id as t, kind
      from notifications where org_id=${ORG} and target_id=${woId}`;
  });
  return {
    users: new Set(rows.filter((r) => r.u).map((r) => r.u as string)),
    tenants: new Set(rows.filter((r) => r.t).map((r) => r.t as string)),
    kindsFor: (u: string) => rows.filter((r) => r.u === u).map((r) => r.kind),
  };
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    ids.admin = await mkUser(tx, "local:m_admin", "Jen (admin)", "admin", "+18010000001");
    ids.dispatcher = await mkUser(tx, "local:m_disp", "Sara (dispatcher)", "dispatcher", null);
    ids.manager = await mkUser(tx, "local:m_mgr", "Diego (manager)", "manager", null);
    ids.staff = await mkUser(tx, "local:m_staff", "Maya (staff)", "staff", null);
    ids.techA = await mkUser(tx, "local:m_techA", "Oscar (tech A)", "technician", "+18010000010");
    ids.techB = await mkUser(tx, "local:m_techB", "Fernando (tech B)", "technician", "+18010000011");

    const mkProp = async (name: string, tech: string | null) => {
      const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name, default_assignee_user_id) values (${ORG}, ${name}, ${tech}) returning id`;
      return p!.id;
    };
    ids.bldgA = await mkProp("Sojo North", ids.techA);
    ids.bldgB = await mkProp("YONIQUE", ids.techB);
    ids.bldgC = await mkProp("New Uncovered Bldg", null); // no covering tech → fallback
    const mkUnit = async (prop: string, label: string) => {
      const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${prop}, ${label}) returning id`;
      return u!.id;
    };
    ids.unitA = await mkUnit(ids.bldgA, "N-1");
    ids.unitB = await mkUnit(ids.bldgB, "Y-1");
    ids.unitC = await mkUnit(ids.bldgC, "U-1");
    const mkTenant = async (unit: string, name: string) => {
      const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status, phone) values (${ORG}, ${unit}, ${`${name}@lucid.test`}, ${name}, 'active', ${"+18019999999"}) returning id`;
      return t!.id;
    };
    ids.tenantA = await mkTenant(ids.unitA, "resA");
    ids.tenantB = await mkTenant(ids.unitB, "resB");
    ids.tenantC = await mkTenant(ids.unitC, "resC");
    // Org fallback = techA, so an uncovered building still auto-assigns.
    await tx`insert into org_settings (org_id, fallback_assignee_user_id) values (${ORG}, ${ids.techA})`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    for (const t of ["notifications", "assignments", "audit_log", "work_orders", "org_settings", "tenant_users", "units", "properties", "users"]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });
  await admin.end();
});

describe.skipIf(skip)("notification matrix (right people, right messages)", () => {
  it("routes a resident's WO to their building's tech + all ops + the resident", async () => {
    const wo = await createWorkOrderFromTenant({ orgId: ORG, tenantUserId: ids.tenantA }, { category: "plumbing", title: "Sink leak" });
    const r = await recipientsOf(wo.id);

    // Right tech: building A's covering tech, and NOT building B's tech.
    expect(r.users.has(ids.techA)).toBe(true);
    expect(r.kindsFor(ids.techA)).toContain("wo_submitted");
    expect(r.users.has(ids.techB)).toBe(false);

    // Right internal staff: every ops role gets the broadcast…
    for (const k of OPS_KEYS) expect(r.users.has(ids[k]), `ops role ${k} notified`).toBe(true);
    // …and technicians are NEVER on the ops broadcast (only their own tech ping).
    expect(r.kindsFor(ids.techA).every((kind) => kind === "wo_submitted")).toBe(true);

    // Right person: the submitting resident gets a confirmation.
    expect(r.tenants.has(ids.tenantA)).toBe(true);
    // …and no OTHER resident is notified.
    expect(r.tenants.has(ids.tenantB)).toBe(false);
  }, 30_000);

  it("routes a different building's resident to a different tech (per-building coverage)", async () => {
    const wo = await createWorkOrderFromTenant({ orgId: ORG, tenantUserId: ids.tenantB }, { category: "hvac", title: "No AC" });
    const r = await recipientsOf(wo.id);
    expect(r.users.has(ids.techB)).toBe(true); // YONIQUE → Fernando
    expect(r.users.has(ids.techA)).toBe(false); // NOT Oscar
    for (const k of OPS_KEYS) expect(r.users.has(ids[k])).toBe(true);
    expect(r.tenants.has(ids.tenantB)).toBe(true);
  }, 30_000);

  it("falls back to the org fallback tech for a building with no coverage (new-building safety net)", async () => {
    const wo = await createWorkOrderFromTenant({ orgId: ORG, tenantUserId: ids.tenantC }, { category: "electrical", title: "Outlet dead" });
    const r = await recipientsOf(wo.id);
    // Uncovered building → fallback (techA) is notified; the WO is never orphaned.
    expect(r.users.has(ids.techA)).toBe(true);
    for (const k of OPS_KEYS) expect(r.users.has(ids[k])).toBe(true);
    expect(r.tenants.has(ids.tenantC)).toBe(true);
  }, 30_000);
});
