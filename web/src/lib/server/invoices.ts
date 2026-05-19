import "server-only";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { invoices } from "@db/schema/financials";
import { approvals } from "@db/schema/approvals";
import { vendors } from "@db/schema/vendors";
import { workOrders } from "@db/schema/work-orders";
import { users } from "@db/schema/users";
import {
  INVOICE_STATUSES,
  approvalLevelFor,
  canInvoiceTransition,
  type InvoiceStatus,
} from "@contracts/financials";
import { withStaffScope, withVendorScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const submitInvoiceInput = z.object({
  vendorId: z.string().uuid(),
  workOrderId: z.string().uuid().optional(),
  invoiceNumber: z.string().max(120).optional(),
  totalCents: z.number().int().min(0),
  attachmentId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Vendor-initiated submission: creates an invoice in `submitted` and, if
 * the amount exceeds the auto-approve threshold, also creates a pending
 * `approvals` row routed to the appropriate level.
 */
export async function submitInvoiceFromVendor(
  ctx: { orgId: string; vendorUserId: string; vendorId: string },
  input: Omit<z.input<typeof submitInvoiceInput>, "vendorId">,
) {
  const parsed = submitInvoiceInput.parse({ ...input, vendorId: ctx.vendorId });
  return withVendorScope(
    { orgId: ctx.orgId, vendorUserId: ctx.vendorUserId },
    async (tx) => {
      const inv = await insertAndMaybeAutoApprove(tx, {
        orgId: ctx.orgId,
        vendorId: parsed.vendorId,
        workOrderId: parsed.workOrderId,
        invoiceNumber: parsed.invoiceNumber,
        totalCents: parsed.totalCents,
        attachmentId: parsed.attachmentId,
        notes: parsed.notes,
        submittedByActorType: "vendor",
        submittedByVendorUserId: ctx.vendorUserId,
      });
      return inv;
    },
  );
}

/**
 * Staff can also create an invoice on behalf of a vendor (e.g. data
 * entry from a paper invoice).
 */
export async function submitInvoiceAsStaff(
  input: z.input<typeof submitInvoiceInput>,
) {
  const parsed = submitInvoiceInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    return insertAndMaybeAutoApprove(tx, {
      orgId: ctx.orgId,
      vendorId: parsed.vendorId,
      workOrderId: parsed.workOrderId,
      invoiceNumber: parsed.invoiceNumber,
      totalCents: parsed.totalCents,
      attachmentId: parsed.attachmentId,
      notes: parsed.notes,
      submittedByActorType: "user",
      submittedByVendorUserId: null,
      enteredByUserId: userId,
    });
  });
}

async function insertAndMaybeAutoApprove(
  tx: ScopedDB,
  args: {
    orgId: string;
    vendorId: string;
    workOrderId?: string;
    invoiceNumber?: string;
    totalCents: number;
    attachmentId?: string;
    notes?: string;
    submittedByActorType: string;
    submittedByVendorUserId: string | null;
    enteredByUserId?: string;
  },
) {
  const level = approvalLevelFor(args.totalCents);
  const initialStatus: InvoiceStatus = level === "auto" ? "approved" : "submitted";

  const inserted = await tx
    .insert(invoices)
    .values({
      orgId: args.orgId,
      vendorId: args.vendorId,
      workOrderId: args.workOrderId ?? null,
      invoiceNumber: args.invoiceNumber ?? null,
      totalCents: String(args.totalCents),
      status: initialStatus,
      attachmentId: args.attachmentId ?? null,
      notes: args.notes ?? null,
      submittedAt: new Date(),
      approvedAt: initialStatus === "approved" ? new Date() : null,
      submittedByActorType: args.submittedByActorType,
      submittedByVendorUserId: args.submittedByVendorUserId,
      approvedByUserId: initialStatus === "approved" ? args.enteredByUserId ?? null : null,
    })
    .returning();
  const row = inserted[0]!;

  // Always log the submit.
  await writeAudit(tx, {
    orgId: args.orgId,
    targetType: "vendor",
    targetId: args.vendorId,
    action: "invoice_submitted",
    actorUserId: args.enteredByUserId ?? null,
    diff: { invoiceId: row.id, totalCents: args.totalCents, level },
  });

  // For amounts requiring approval, create an approval row.
  if (level !== "auto") {
    await tx.insert(approvals).values({
      orgId: args.orgId,
      targetType: "vendor", // approvals are polymorphic; we hang it off vendor
      targetId: args.vendorId,
      reason: `invoice_${level}_review`,
      amountCents: String(args.totalCents),
      status: "pending",
      requestedByUserId: args.enteredByUserId ?? null,
      notes: `Invoice ${row.id} (${row.invoiceNumber ?? "no #"}) for $${(args.totalCents / 100).toFixed(2)}`,
    });
  }

  return { invoice: row, approvalLevel: level };
}

/**
 * Operator-context invoice list — joins vendor + WO + approver so the
 * /money invoices tab can show "STK-3041 · Stark Plumbing · WO-1001 ·
 * approved by AR" instead of a bare ID + status. Used by the rendered
 * money surface; `listInvoices()` below stays unchanged for tests +
 * legacy admin views.
 */
export interface InvoiceRow {
  id: string;
  invoiceNumber: string | null;
  totalCents: string;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  updatedAt: Date;
  vendorId: string;
  vendorName: string | null;
  workOrderId: string | null;
  workOrderRef: string | null;
  workOrderTitle: string | null;
  approverName: string | null;
}

export async function listInvoicesEnriched(): Promise<InvoiceRow[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        totalCents: invoices.totalCents,
        status: invoices.status,
        submittedAt: invoices.submittedAt,
        approvedAt: invoices.approvedAt,
        paidAt: invoices.paidAt,
        updatedAt: invoices.updatedAt,
        vendorId: invoices.vendorId,
        vendorName: vendors.name,
        workOrderId: invoices.workOrderId,
        workOrderNumber: workOrders.number,
        workOrderTitle: workOrders.title,
        approverName: users.name,
        approverEmail: users.email,
      })
      .from(invoices)
      .leftJoin(vendors, eq(vendors.id, invoices.vendorId))
      .leftJoin(workOrders, eq(workOrders.id, invoices.workOrderId))
      .leftJoin(users, eq(users.id, invoices.approvedByUserId))
      .where(eq(invoices.orgId, ctx.orgId))
      .orderBy(desc(invoices.createdAt))
      .limit(200);

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      totalCents: String(r.totalCents),
      status: r.status,
      submittedAt: r.submittedAt,
      approvedAt: r.approvedAt,
      paidAt: r.paidAt,
      updatedAt: r.updatedAt,
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      workOrderId: r.workOrderId,
      workOrderRef: r.workOrderNumber ? `WO-${r.workOrderNumber}` : null,
      workOrderTitle: r.workOrderTitle,
      approverName: r.approverName ?? (r.approverEmail ? r.approverEmail.split("@")[0] ?? null : null),
    }));
  });
}

export async function listInvoices(filter?: { status?: InvoiceStatus; vendorId?: string }) {
  return withStaffScope(async (tx, ctx) => {
    const conds = [eq(invoices.orgId, ctx.orgId)];
    if (filter?.status) conds.push(eq(invoices.status, filter.status));
    if (filter?.vendorId) conds.push(eq(invoices.vendorId, filter.vendorId));
    return tx
      .select()
      .from(invoices)
      .where(and(...conds))
      .orderBy(desc(invoices.createdAt))
      .limit(500);
  });
}

export const transitionInvoiceInput = z.object({
  id: z.string().uuid(),
  to: z.enum(INVOICE_STATUSES),
});

export async function transitionInvoice(input: z.input<typeof transitionInvoiceInput>) {
  const parsed = transitionInvoiceInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const cur = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, ctx.orgId), eq(invoices.id, parsed.id)))
      .limit(1);
    const inv = cur[0];
    if (!inv) throw new Error("invoice_not_found");
    if (inv.status === parsed.to) return inv;
    if (!canInvoiceTransition(inv.status as InvoiceStatus, parsed.to)) {
      throw new Error(`invalid_transition:${inv.status}->${parsed.to}`);
    }
    const patch: Partial<typeof invoices.$inferInsert> = {
      status: parsed.to,
      updatedAt: new Date(),
    };
    if (parsed.to === "approved") {
      patch.approvedAt = new Date();
      patch.approvedByUserId = userId;
    }
    if (parsed.to === "paid") {
      patch.paidAt = new Date();
      patch.paidByUserId = userId;
    }
    const updated = await tx
      .update(invoices)
      .set(patch)
      .where(eq(invoices.id, parsed.id))
      .returning();
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "vendor",
      targetId: inv.vendorId,
      action: "invoice_transitioned",
      actorUserId: userId,
      diff: { invoiceId: inv.id, from: inv.status, to: parsed.to },
    });
    return updated[0]!;
  });
}

export { INVOICE_STATUSES };
