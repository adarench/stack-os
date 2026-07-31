/**
 * Full work-order lifecycle over SMS — a resident submits a request and it moves
 * submit → in_progress → resolved → verified. At each stage this asserts WHO gets
 * a text (tenant, assigned tech, internal CPM/ops) and that the link is the
 * correct role-appropriate deep link into the ACTUAL work order (not a hardcoded
 * one). The Twilio send is mocked; everything else is the real pipeline.
 * Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ORG = `org_smslc_${Date.now()}`;
const OP_CLERK = `local:op_${Date.now()}`; // the operator making status changes (NOT the tech)

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: OP_CLERK, orgId: ORG, email: "op@ops.test", name: "Op", role: "dispatcher" })),
  isOperatorAllowed: vi.fn(async () => true),
}));
vi.mock("@/lib/server/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/sms")>();
  return { ...actual, sendSms: vi.fn(async () => ({ id: "SMx" })) };
});

import postgres from "postgres";
import { sendSms } from "@/lib/server/sms";
import { createWorkOrderFromTenant, tenantConfirmResolved } from "@/lib/server/tenant-work-orders";
import { updateWorkOrderStatus } from "@/lib/server/work-orders";

const smsMock = sendSms as unknown as ReturnType<typeof vi.fn>;
const TENANT_PHONE = "+15039151351";
const TECH_PHONE = "+13852211268";
const JEN_PHONE = "+18013809434";
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { techId: "", jenId: "", opId: "", tenantId: "", unitId: "", propId: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}
/** Bodies texted to a given number since the last clear. */
function bodiesTo(phone: string): string[] {
  return smsMock.mock.calls.filter((c) => (c[0] as { to: string }).to === phone).map((c) => (c[0] as { body: string }).body);
}
beforeEach(() => smsMock.mockClear());

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [tech] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role, phone) values (${ORG}, ${"local:tech"}, ${"oscar@stackwithus.test"}, ${"Oscar"}, 'technician', ${TECH_PHONE}) returning id`;
    ids.techId = tech!.id;
    const [jen] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role, phone) values (${ORG}, ${"local:jen"}, ${"jen@stackwithus.test"}, ${"Jen"}, 'admin', ${JEN_PHONE}) returning id`;
    ids.jenId = jen!.id;
    const [op] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_CLERK}, ${"op@ops.test"}, ${"Op"}, 'dispatcher') returning id`;
    ids.opId = op!.id;
    // Property routes to the tech; tenant lives on its unit.
    const [p] = await tx<{ id: string }[]>`insert into properties (org_id, name, default_assignee_user_id) values (${ORG}, ${"Lucid Demo"}, ${ids.techId}) returning id`;
    ids.propId = p!.id;
    const [u] = await tx<{ id: string }[]>`insert into units (org_id, property_id, label) values (${ORG}, ${ids.propId}, ${"Suite 100"}) returning id`;
    ids.unitId = u!.id;
    const [t] = await tx<{ id: string }[]>`insert into tenant_users (org_id, unit_id, email, name, status, phone) values (${ORG}, ${ids.unitId}, ${"sam@lucid.test"}, ${"Sam"}, 'active', ${TENANT_PHONE}) returning id`;
    ids.tenantId = t!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    for (const t of ["notifications", "comments", "attachments", "assignments", "audit_log", "work_orders", "tenant_users", "units", "properties", "users"]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });
  await admin.end();
});

describe.skipIf(skip)("full WO lifecycle over SMS", () => {
  it("texts the right people with the right link at each stage", async () => {
    const session = { orgId: ORG, tenantUserId: ids.tenantId };

    // --- 1. Resident submits ---
    const wo = await createWorkOrderFromTenant(session, { category: "plumbing", title: "Kitchen sink leak" });
    const n = wo.number;
    const link = { tenant: `/tenant/WO-${n}`, tech: `/tech/WO-${n}`, ops: `/work-orders/${wo.id}` };

    // resident gets a "received" text; tech gets the new job; Jen (CPM) gets the new request
    expect(bodiesTo(TENANT_PHONE).some((b) => b.includes(link.tenant) && /received|got your request/i.test(b))).toBe(true);
    expect(bodiesTo(TECH_PHONE).some((b) => b.includes(link.tech))).toBe(true);
    expect(bodiesTo(JEN_PHONE).some((b) => b.includes(link.ops) && /New request/i.test(b))).toBe(true);

    // --- 2. Operator marks in progress (tenant-facing only) ---
    smsMock.mockClear();
    await updateWorkOrderStatus({ id: wo.id, to: "in_progress" });
    expect(bodiesTo(TENANT_PHONE).some((b) => b.includes(link.tenant))).toBe(true);
    // in_progress isn't a "key" staff transition → no tech/ops text here
    expect(bodiesTo(TECH_PHONE)).toHaveLength(0);
    expect(bodiesTo(JEN_PHONE)).toHaveLength(0);

    // --- 3. Operator resolves (everyone hears, tailored) ---
    smsMock.mockClear();
    await updateWorkOrderStatus({ id: wo.id, to: "resolved" });
    expect(bodiesTo(TENANT_PHONE).some((b) => b.includes(link.tenant))).toBe(true);
    expect(bodiesTo(TECH_PHONE).some((b) => b.includes(link.tech))).toBe(true);
    expect(bodiesTo(JEN_PHONE).some((b) => b.includes(link.ops) && /Completed/i.test(b))).toBe(true);

    // --- 4. Resident confirms fixed → verified ---
    smsMock.mockClear();
    await tenantConfirmResolved(session, wo.id);
    // covering tech is told the resident confirmed
    expect(bodiesTo(TECH_PHONE).some((b) => b.includes(link.tech))).toBe(true);
  }, 45_000);
});
