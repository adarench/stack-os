import "server-only";
import { eq } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { withStaffScope } from "./db";

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
