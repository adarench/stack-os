import { pgTable, text, uuid, timestamp, numeric, index, doublePrecision } from "drizzle-orm/pg-core";
import { id, orgId, timestamps, costKindEnum, invoiceStatusEnum } from "./_shared";

export const taskCosts = pgTable(
  "task_costs",
  {
    id: id(),
    orgId: orgId(),
    workOrderId: uuid("work_order_id").notNull(),

    kind: costKindEnum("kind").notNull().default("other"),
    description: text("description"),
    amountCents: numeric("amount_cents").notNull(),

    enteredByActorType: text("entered_by_actor_type").notNull().default("user"),
    enteredByUserId: uuid("entered_by_user_id"),
    enteredByVendorUserId: uuid("entered_by_vendor_user_id"),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("task_costs_org_idx").on(t.orgId),
    woIdx: index("task_costs_work_order_idx").on(t.workOrderId),
  }),
);

export const taskTimeEntries = pgTable(
  "task_time_entries",
  {
    id: id(),
    orgId: orgId(),
    workOrderId: uuid("work_order_id").notNull(),

    vendorUserId: uuid("vendor_user_id"),
    userId: uuid("user_id"),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    hoursDecimal: doublePrecision("hours_decimal"),
    hourlyRateCents: numeric("hourly_rate_cents"),

    notes: text("notes"),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("task_time_entries_org_idx").on(t.orgId),
    woIdx: index("task_time_entries_work_order_idx").on(t.workOrderId),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    orgId: orgId(),
    vendorId: uuid("vendor_id").notNull(),
    workOrderId: uuid("work_order_id"), // nullable — supports batch invoices
    invoiceNumber: text("invoice_number"),
    totalCents: numeric("total_cents").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    attachmentId: uuid("attachment_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),

    submittedByActorType: text("submitted_by_actor_type"),
    submittedByVendorUserId: uuid("submitted_by_vendor_user_id"),
    approvedByUserId: uuid("approved_by_user_id"),
    paidByUserId: uuid("paid_by_user_id"),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("invoices_org_idx").on(t.orgId),
    vendorIdx: index("invoices_vendor_idx").on(t.vendorId),
    woIdx: index("invoices_work_order_idx").on(t.workOrderId),
    statusIdx: index("invoices_status_idx").on(t.orgId, t.status),
  }),
);
