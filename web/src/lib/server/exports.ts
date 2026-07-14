import "server-only";
import { eq } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { withStaffScope } from "./db";
import { loadBuildingReport, loadVendorReport } from "./reporting-summary";

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

/** Per-building open + aging counts, for CSV export from the reports page. */
export async function exportBuildingsCsv() {
  return loadBuildingReport();
}

/** Per-vendor load + COI state, for CSV export from the reports page. */
export async function exportVendorsCsv() {
  return loadVendorReport();
}
