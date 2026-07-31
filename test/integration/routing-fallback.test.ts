/**
 * Routing — building tech first, then the org fallback (ASN-003) so a staff-created
 * WO never lands unassigned, matching the tenant path. Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_route_${Date.now()}`;
const OP_CLERK = `local:routeop_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: OP_CLERK, orgId: ORG, email: "op@ops.test", name: "Op", role: "dispatcher" })),
  isOperatorAllowed: vi.fn(async () => true),
}));

import postgres from "postgres";
import { createWorkOrder } from "@/lib/server/work-orders";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { techId: "", fallbackId: "", coveredProp: "", uncoveredProp: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}
async function assigneeOf(woId: string): Promise<string | null> {
  const rows = await admin!.begin(async (tx) => {
    await sys(tx);
    return tx<{ assignee_id: string }[]>`select assignee_id from assignments where org_id=${ORG} and target_id=${woId} and unassigned_at is null`;
  });
  return rows[0]?.assignee_id ?? null;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_CLERK}, ${"op@ops.test"}, ${"Op"}, 'dispatcher')`;
    const [t] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${"local:rtech"}, ${"tech@r.test"}, ${"Building Tech"}, 'technician') returning id`;
    ids.techId = t!.id;
    const [f] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${"local:rfb"}, ${"fb@r.test"}, ${"Fallback Tech"}, 'technician') returning id`;
    ids.fallbackId = f!.id;
    const [cp] = await tx<{ id: string }[]>`insert into properties (org_id, name, default_assignee_user_id) values (${ORG}, ${"Covered Bldg"}, ${ids.techId}) returning id`;
    ids.coveredProp = cp!.id;
    const [up] = await tx<{ id: string }[]>`insert into properties (org_id, name) values (${ORG}, ${"Uncovered Bldg"}) returning id`;
    ids.uncoveredProp = up!.id;
    await tx`insert into org_settings (org_id, fallback_assignee_user_id) values (${ORG}, ${ids.fallbackId})`;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    for (const t of ["assignments", "audit_log", "work_orders", "org_settings", "properties", "users"]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });
  await admin.end();
});

describe.skipIf(skip)("WO routing fallback (ASN-003)", () => {
  it("routes to the building's covering tech when set", async () => {
    const wo = await createWorkOrder({ title: "Covered", propertyId: ids.coveredProp });
    expect(await assigneeOf(wo.id)).toBe(ids.techId);
  }, 30_000);

  it("falls back to the org fallback when the building has no tech", async () => {
    const wo = await createWorkOrder({ title: "Uncovered", propertyId: ids.uncoveredProp });
    expect(await assigneeOf(wo.id)).toBe(ids.fallbackId);
  }, 30_000);

  it("falls back to the org fallback when there is no building at all", async () => {
    const wo = await createWorkOrder({ title: "No building" });
    expect(await assigneeOf(wo.id)).toBe(ids.fallbackId);
  }, 30_000);
});
