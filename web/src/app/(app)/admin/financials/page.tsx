import Link from "next/link";
import { listInvoices } from "@/lib/server/invoices";
import { listVendors } from "@/lib/server/vendors";
import {
  INVOICE_STATUSES,
  canInvoiceTransition,
  type InvoiceStatus,
} from "@contracts/financials";
import { staffSubmitInvoiceAction, transitionInvoiceAction } from "./_actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<InvoiceStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  disputed: "bg-rose-100 text-rose-800",
  void: "bg-neutral-200 text-neutral-500",
};

export default async function FinancialsPage() {
  const [rows, vendors] = await Promise.all([listInvoices(), listVendors()]);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const totals = rows.reduce(
    (acc, r) => {
      acc[r.status as InvoiceStatus] =
        (acc[r.status as InvoiceStatus] ?? 0) + Number(r.totalCents);
      return acc;
    },
    {} as Record<InvoiceStatus, number>,
  );

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Financials</h1>
        <Link
          href="/admin/approvals"
          className="ml-auto rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
        >
          Approvals
        </Link>
      </header>

      <section className="mb-4 grid grid-cols-3 gap-2 text-xs">
        {INVOICE_STATUSES.map((s) => (
          <div key={s} className="rounded border border-neutral-200 bg-white p-2">
            <div className="text-neutral-500 uppercase">{s}</div>
            <div className="mt-1 font-mono text-sm">
              ${((totals[s] ?? 0) / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </section>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Submit invoice (staff entry)
        </h2>
        <form action={staffSubmitInvoiceAction} className="grid grid-cols-2 gap-2 text-sm">
          <select
            required
            name="vendorId"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">— vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input
            name="invoiceNumber"
            placeholder="Invoice #"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            required
            name="totalCents"
            type="number"
            min={0}
            placeholder="Total (cents)"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Notes"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="col-span-2 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Submit
          </button>
        </form>
        <p className="mt-1 text-xs text-neutral-500">
          ≤ $500 auto-approves. $500–$5K → manager review. &gt; $5K → owner.
        </p>
      </section>

      <ul className="space-y-2">
        {rows.map((inv) => {
          const v = vendorById.get(inv.vendorId);
          const next = INVOICE_STATUSES.filter((s) =>
            canInvoiceTransition(inv.status as InvoiceStatus, s),
          );
          return (
            <li
              key={inv.id}
              className="rounded border border-neutral-200 bg-white p-3 text-sm"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{v?.name ?? "(vendor)"}</span>
                <span className="text-xs text-neutral-500">
                  {inv.invoiceNumber ?? "no #"}
                </span>
                <span className="ml-auto font-mono">
                  ${(Number(inv.totalCents) / 100).toFixed(2)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                    STATUS_PILL[inv.status as InvoiceStatus]
                  }`}
                >
                  {inv.status}
                </span>
                {inv.submittedAt && (
                  <span className="text-xs text-neutral-500">
                    submitted {new Date(inv.submittedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {next.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {next.map((to) => (
                    <form key={to} action={transitionInvoiceAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <input type="hidden" name="to" value={to} />
                      <button
                        type="submit"
                        className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-700"
                      >
                        → {to}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
