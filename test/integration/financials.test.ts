/**
 * P6 financials integration tests.
 *
 * Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_p6_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_p6_${Date.now()}`;

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({
    userId: TEST_CLERK_USER_ID,
    orgId: TEST_ORG,
    sessionClaims: {},
    orgRole: "org:admin",
    orgSlug: null,
    has: () => false,
  })),
  currentUser: vi.fn(async () => ({
    id: TEST_CLERK_USER_ID,
    primaryEmailAddress: { emailAddress: "p6-test@stack-os.example" },
    emailAddresses: [{ emailAddress: "p6-test@stack-os.example" }],
    firstName: "P6",
    lastName: "Test",
  })),
}));

import postgres from "postgres";
import { createProperty } from "@/lib/server/properties";
import { createVendor } from "@/lib/server/vendors";
import { createWorkOrder } from "@/lib/server/work-orders";
import { addCost, listCosts, totalForWorkOrder, costBreakdown } from "@/lib/server/costs";
import {
  submitInvoiceAsStaff,
  transitionInvoice,
  listInvoices,
} from "@/lib/server/invoices";
import { listPendingApprovals, decideApproval } from "@/lib/server/approvals";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;

beforeAll(async () => {
  if (skip || !url) return;
  if (!process.env.VENDOR_MAGIC_LINK_SECRET) {
    process.env.VENDOR_MAGIC_LINK_SECRET = "test_secret_at_least_32_characters_long_xxx";
  }
  admin = postgres(url, { max: 1 });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
    await tx`set local role app_user`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from invoices where org_id = ${TEST_ORG}`;
    await tx`delete from approvals where org_id = ${TEST_ORG}`;
    await tx`delete from task_costs where org_id = ${TEST_ORG}`;
    await tx`delete from task_time_entries where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from vendors where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("P6 costs", () => {
  let propertyId: string;
  let workOrderId: string;

  beforeAll(async () => {
    if (skip) return;
    const p = await createProperty({ name: "P6 prop", city: "Boise", state: "ID" });
    propertyId = p.id;
    const wo = await createWorkOrder({ title: "Cost test", priority: "normal", propertyId });
    workOrderId = wo.id;
  });

  it("addCost + listCosts roundtrip", async () => {
    await addCost({
      workOrderId,
      kind: "labor",
      description: "2hr plumber",
      amountCents: 15000,
    });
    await addCost({
      workOrderId,
      kind: "materials",
      description: "P-trap",
      amountCents: 4500,
    });
    const cs = await listCosts(workOrderId);
    expect(cs.length).toBe(2);
  });

  it("totalForWorkOrder sums correctly", async () => {
    expect(await totalForWorkOrder(workOrderId)).toBe(15000 + 4500);
  });

  it("costBreakdown groups by kind", async () => {
    const b = await costBreakdown(workOrderId);
    expect(b.labor).toBe(15000);
    expect(b.materials).toBe(4500);
    expect(b.fee).toBe(0);
  });
});

describe.skipIf(skip)("P6 invoices + approvals", () => {
  let vendorId: string;

  beforeAll(async () => {
    if (skip) return;
    const v = await createVendor({ name: "P6 vendor" });
    vendorId = v.id;
  });

  it("under-threshold invoice auto-approves", async () => {
    const r = await submitInvoiceAsStaff({
      vendorId,
      invoiceNumber: "INV-AUTO",
      totalCents: 10000, // $100
    });
    expect(r.approvalLevel).toBe("auto");
    expect(r.invoice.status).toBe("approved");
    expect(r.invoice.approvedAt).toBeTruthy();
  });

  it("manager-band invoice creates a pending approval", async () => {
    const r = await submitInvoiceAsStaff({
      vendorId,
      invoiceNumber: "INV-MGR",
      totalCents: 75000, // $750
    });
    expect(r.approvalLevel).toBe("manager");
    expect(r.invoice.status).toBe("submitted");
    const pending = await listPendingApprovals();
    expect(pending.some((a) => a.reason === "invoice_manager_review")).toBe(true);
  });

  it("owner-band invoice creates a pending owner-level approval", async () => {
    const r = await submitInvoiceAsStaff({
      vendorId,
      invoiceNumber: "INV-OWN",
      totalCents: 800_000, // $8000
    });
    expect(r.approvalLevel).toBe("owner");
    const pending = await listPendingApprovals();
    expect(pending.some((a) => a.reason === "invoice_owner_review")).toBe(true);
  });

  it("decideApproval records the decision and audit", async () => {
    const pending = await listPendingApprovals();
    const first = pending[0];
    if (!first) return;
    const updated = await decideApproval({ id: first.id, to: "approved" });
    expect(updated.status).toBe("approved");
    expect(updated.decidedAt).toBeTruthy();
  });

  it("transitionInvoice walks submitted → approved → paid", async () => {
    const all = await listInvoices({ status: "submitted" });
    const inv = all[0];
    if (!inv) return;
    const a = await transitionInvoice({ id: inv.id, to: "approved" });
    expect(a.status).toBe("approved");
    const p = await transitionInvoice({ id: inv.id, to: "paid" });
    expect(p.status).toBe("paid");
    expect(p.paidAt).toBeTruthy();
  }, 20_000);

  it("rejects invalid transitions", async () => {
    const all = await listInvoices({ status: "paid" });
    const inv = all[0];
    if (!inv) return;
    await expect(
      transitionInvoice({ id: inv.id, to: "draft" }),
    ).rejects.toThrow(/invalid_transition/);
  });
});
