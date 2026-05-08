/**
 * P7 dashboard integration test.
 *
 * Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_p7_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_p7_${Date.now()}`;

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
    primaryEmailAddress: { emailAddress: "p7-test@stack-os.example" },
    emailAddresses: [{ emailAddress: "p7-test@stack-os.example" }],
    firstName: "P7",
    lastName: "Test",
  })),
}));

import postgres from "postgres";
import { createProperty } from "@/lib/server/properties";
import { createVendor } from "@/lib/server/vendors";
import { createWorkOrder, updateWorkOrderStatus } from "@/lib/server/work-orders";
import { addCost } from "@/lib/server/costs";
import { submitInvoiceAsStaff } from "@/lib/server/invoices";
import { loadDashboard, exportWorkOrdersCsv } from "@/lib/server/dashboard";

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
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from vendors where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("P7 dashboard", () => {
  let propertyId: string;
  let vendorId: string;

  beforeAll(async () => {
    if (skip) return;
    const p = await createProperty({ name: "P7 prop", city: "Boise", state: "ID" });
    propertyId = p.id;
    const v = await createVendor({ name: "P7 vendor" });
    vendorId = v.id;

    // 3 open WOs, 1 closed
    const wo1 = await createWorkOrder({ title: "WO1", priority: "normal", propertyId });
    const wo2 = await createWorkOrder({ title: "WO2", priority: "high", propertyId });
    await createWorkOrder({ title: "WO3", priority: "urgent", propertyId });
    // Walk wo1 to closed
    for (const to of ["triaged", "assigned", "scheduled", "in_progress", "resolved", "verified", "closed"] as const) {
      await updateWorkOrderStatus({ id: wo1.id, to });
    }
    // Add some costs to wo2
    await addCost({ workOrderId: wo2.id, kind: "labor", amountCents: 12000 });
    await addCost({ workOrderId: wo2.id, kind: "materials", amountCents: 4500 });
    // Auto-approved invoice
    await submitInvoiceAsStaff({ vendorId, totalCents: 9900, invoiceNumber: "INV-DASH-1" });
    // Pending-approval invoice
    await submitInvoiceAsStaff({ vendorId, totalCents: 60000, invoiceNumber: "INV-DASH-2" });
  }, 60_000);

  it("loadDashboard returns counts and totals", async () => {
    const d = await loadDashboard();
    expect(d.workOrders.byStatus.new).toBeGreaterThanOrEqual(2);
    expect(d.workOrders.byStatus.closed).toBeGreaterThanOrEqual(1);
    expect(d.workOrders.open).toBeGreaterThanOrEqual(2);
    // Costs added in this run = 16500
    expect(d.financials.mtdCostCents).toBeGreaterThanOrEqual(16500);
    // Invoice $99 auto-approved (paid? no — approved); pending $600 submitted
    expect(d.financials.invoicesPendingApprovalCents).toBeGreaterThanOrEqual(60000);
    expect(d.financials.invoicesApprovedNotPaidCents).toBeGreaterThanOrEqual(9900);
    // Vendors
    expect(d.vendors.total).toBeGreaterThanOrEqual(1);
    expect(d.vendors.active).toBeGreaterThanOrEqual(1);
  });

  it("exportWorkOrdersCsv returns rows ordered by number", async () => {
    const rows = await exportWorkOrdersCsv();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const numbers = rows.map((r) => r.number);
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(numbers).toEqual(sorted);
  });
});
