import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { vendors } from "@db/schema/vendors";
import { vendorUsers } from "@db/schema/vendor-users";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const createVendorInput = z.object({
  name: z.string().min(1).max(200),
  trade: z.string().max(60).optional(),
  primaryContactName: z.string().max(120).optional(),
  primaryEmail: z.string().email().optional(),
  primaryPhone: z.string().max(40).optional(),
});

export async function createVendor(input: z.infer<typeof createVendorInput>) {
  const parsed = createVendorInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(vendors)
      .values({
        orgId: ctx.orgId,
        name: parsed.name,
        trade: parsed.trade ?? null,
        primaryContactName: parsed.primaryContactName ?? null,
        primaryEmail: parsed.primaryEmail ?? null,
        primaryPhone: parsed.primaryPhone ?? null,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "vendor",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { to: { name: parsed.name, trade: parsed.trade } },
    });
    return row;
  });
}

export async function listVendors() {
  return withStaffScope(async (tx, ctx) =>
    tx.select().from(vendors).where(eq(vendors.orgId, ctx.orgId)).orderBy(asc(vendors.name)),
  );
}

export async function listVendorUsersForVendor(vendorId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(vendorUsers)
      .where(and(eq(vendorUsers.orgId, ctx.orgId), eq(vendorUsers.vendorId, vendorId))),
  );
}

export interface AssignableVendorUser {
  id: string;
  name: string | null;
  email: string;
  vendorId: string;
  vendorName: string;
  vendorTrade: string | null;
  /** COI gate signal. 'active' / 'expiring' are usable; 'expired' / 'missing'
   *  block assignment via the COI gate (unless overrideCoi). */
  coiState: "active" | "expiring" | "expired" | "missing";
}

/**
 * List vendor_users assignable to a work-order from the operator drawer.
 * Joined with vendors for display + worst-case COI status per vendor.
 *
 * COI state: 'missing' if no COI row exists at all; otherwise the worst
 * status across all the vendor's COI rows ('expired' beats 'expiring'
 * beats 'active'). The drawer renders blocked rows visibly but disabled.
 */
export async function listAssignableVendorUsers(): Promise<
  AssignableVendorUser[]
> {
  return withStaffScope(async (tx, ctx) => {
    const { vendorCois } = await import("@db/schema/compliance");
    const rows = await tx
      .select({
        userId: vendorUsers.id,
        userName: vendorUsers.name,
        userEmail: vendorUsers.email,
        vendorId: vendors.id,
        vendorName: vendors.name,
        vendorTrade: vendors.trade,
      })
      .from(vendorUsers)
      .innerJoin(vendors, eq(vendors.id, vendorUsers.vendorId))
      .where(and(eq(vendorUsers.orgId, ctx.orgId), eq(vendors.orgId, ctx.orgId)))
      .orderBy(asc(vendors.name), asc(vendorUsers.email));

    const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId)));
    const cois =
      vendorIds.length === 0
        ? []
        : await tx
            .select({
              vendorId: vendorCois.vendorId,
              status: vendorCois.status,
            })
            .from(vendorCois)
            .where(eq(vendorCois.orgId, ctx.orgId));
    const worstByVendor = new Map<string, "active" | "expiring" | "expired">();
    for (const c of cois) {
      const cur = worstByVendor.get(c.vendorId);
      const next = c.status as "active" | "expiring" | "expired";
      // Worst-case wins: expired > expiring > active.
      if (
        !cur ||
        next === "expired" ||
        (next === "expiring" && cur === "active")
      ) {
        worstByVendor.set(c.vendorId, next);
      }
    }

    return rows.map(
      (r): AssignableVendorUser => ({
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        vendorTrade: r.vendorTrade,
        coiState: worstByVendor.get(r.vendorId) ?? "missing",
      }),
    );
  });
}
