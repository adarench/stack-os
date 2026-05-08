import "server-only";
import { and, eq, gte, lt, lte, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { vendorCois } from "@db/schema/compliance";
import { tenantInsurancePolicies } from "@db/schema/compliance";
import { taskCosts } from "@db/schema/financials";
import { invoices } from "@db/schema/financials";
import { vendors } from "@db/schema/vendors";
import { withStaffScope, type ScopedDB } from "./db";
import { WORK_ORDER_STATUSES, type WorkOrderStatus } from "@contracts/state-machines/work-order";

export interface DashboardSnapshot {
  generatedAt: string;
  workOrders: {
    open: number;
    overdue: number;
    byStatus: Record<WorkOrderStatus, number>;
    new7d: number;
    closed7d: number;
  };
  compliance: {
    coisExpiring: number;
    coisExpired: number;
    tenantInsExpiring: number;
    tenantInsExpired: number;
  };
  financials: {
    mtdCostCents: number;
    invoicesPendingApprovalCents: number;
    invoicesApprovedNotPaidCents: number;
    invoicesPaidMtdCents: number;
  };
  vendors: {
    total: number;
    active: number;
  };
}

const TERMINAL: WorkOrderStatus[] = ["closed", "cancelled"];

export async function loadDashboard(now: Date = new Date()): Promise<DashboardSnapshot> {
  return withStaffScope(async (tx, ctx) => {
    const orgId = ctx.orgId;
    const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Work-order counts by status
    const woStatusRows = await tx
      .select({
        status: workOrders.status,
        n: drizzleSql<string>`count(*)::text`,
      })
      .from(workOrders)
      .where(eq(workOrders.orgId, orgId))
      .groupBy(workOrders.status);
    const byStatus: Record<WorkOrderStatus, number> = {} as never;
    for (const s of WORK_ORDER_STATUSES) byStatus[s] = 0;
    for (const r of woStatusRows) byStatus[r.status as WorkOrderStatus] = Number(r.n);

    const open = WORK_ORDER_STATUSES.filter((s) => !TERMINAL.includes(s)).reduce(
      (sum, s) => sum + (byStatus[s] ?? 0),
      0,
    );

    // Overdue: dueAt < now AND not terminal
    const overdueRows = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, orgId),
          lt(workOrders.dueAt, now),
          drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled')`,
        ),
      );
    const overdue = Number(overdueRows[0]?.n ?? 0);

    // 7-day windows
    const new7Rows = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, orgId), gte(workOrders.createdAt, ago7)));
    const new7d = Number(new7Rows[0]?.n ?? 0);
    const closed7Rows = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, orgId),
          gte(workOrders.completedAt, ago7),
          eq(workOrders.status, "closed" as WorkOrderStatus),
        ),
      );
    const closed7d = Number(closed7Rows[0]?.n ?? 0);

    // Compliance counts
    const compliance = await complianceCounts(tx, orgId);

    // Financials: MTD costs (sum task_costs since monthStart)
    const mtdCostRows = await tx
      .select({
        total: drizzleSql<string | null>`coalesce(sum(${taskCosts.amountCents}), 0)`,
      })
      .from(taskCosts)
      .where(
        and(eq(taskCosts.orgId, orgId), gte(taskCosts.createdAt, monthStart)),
      );
    const mtdCostCents = Number(mtdCostRows[0]?.total ?? 0);

    const invoicePending = await tx
      .select({
        total: drizzleSql<string | null>`coalesce(sum(${invoices.totalCents}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "submitted")));
    const invoicesPendingApprovalCents = Number(invoicePending[0]?.total ?? 0);

    const invoiceApproved = await tx
      .select({
        total: drizzleSql<string | null>`coalesce(sum(${invoices.totalCents}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "approved")));
    const invoicesApprovedNotPaidCents = Number(invoiceApproved[0]?.total ?? 0);

    const invoicePaid = await tx
      .select({
        total: drizzleSql<string | null>`coalesce(sum(${invoices.totalCents}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, monthStart),
        ),
      );
    const invoicesPaidMtdCents = Number(invoicePaid[0]?.total ?? 0);

    // Vendors
    const vendorAll = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(vendors)
      .where(eq(vendors.orgId, orgId));
    const vendorActive = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(vendors)
      .where(and(eq(vendors.orgId, orgId), eq(vendors.status, "active")));

    return {
      generatedAt: now.toISOString(),
      workOrders: { open, overdue, byStatus, new7d, closed7d },
      compliance,
      financials: {
        mtdCostCents,
        invoicesPendingApprovalCents,
        invoicesApprovedNotPaidCents,
        invoicesPaidMtdCents,
      },
      vendors: {
        total: Number(vendorAll[0]?.n ?? 0),
        active: Number(vendorActive[0]?.n ?? 0),
      },
    };
  });
}

async function complianceCounts(tx: ScopedDB, orgId: string) {
  const cois = await tx
    .select({
      status: vendorCois.status,
      n: drizzleSql<string>`count(*)::text`,
    })
    .from(vendorCois)
    .where(eq(vendorCois.orgId, orgId))
    .groupBy(vendorCois.status);
  const tenantIns = await tx
    .select({
      status: tenantInsurancePolicies.status,
      n: drizzleSql<string>`count(*)::text`,
    })
    .from(tenantInsurancePolicies)
    .where(eq(tenantInsurancePolicies.orgId, orgId))
    .groupBy(tenantInsurancePolicies.status);
  const find = (rows: Array<{ status: string; n: string }>, s: string) =>
    Number(rows.find((r) => r.status === s)?.n ?? 0);
  return {
    coisExpiring: find(cois, "expiring"),
    coisExpired: find(cois, "expired"),
    tenantInsExpiring: find(tenantIns, "expiring"),
    tenantInsExpired: find(tenantIns, "expired"),
  };
}

/**
 * CSV-friendly listing for export. Returns work_orders with property + unit
 * names. Comma-encoded by the route handler.
 */
export async function exportWorkOrdersCsv() {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select()
      .from(workOrders)
      .where(eq(workOrders.orgId, ctx.orgId))
      .orderBy(workOrders.number);
    return rows;
  });
}
