import "server-only";
import { sql } from "drizzle-orm";
import type { ScopedDB } from "./db";
import { workOrders } from "@db/schema/work-orders";
import { eq } from "drizzle-orm";

/**
 * Allocate the next per-org work_orders.number.
 *
 * Production-grade approach (P3+): a dedicated `org_sequences` table with
 * advisory locks. For P1 we use `MAX(number) + 1` inside the same
 * transaction that inserts the row; collisions are vanishingly rare at this
 * scale and the unique index on (org_id, number) catches anything we miss.
 */
export async function nextWorkOrderNumber(
  tx: ScopedDB,
  orgId: string,
): Promise<number> {
  const rows = await tx
    .select({ max: sql<number | null>`max(${workOrders.number})` })
    .from(workOrders)
    .where(eq(workOrders.orgId, orgId));
  const current = rows[0]?.max ?? 0;
  return Number(current ?? 0) + 1;
}
