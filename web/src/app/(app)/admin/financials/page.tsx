import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listInvoices } from "@/lib/server/invoices";
import { listVendors } from "@/lib/server/vendors";
import {
  INVOICE_STATUSES,
  canInvoiceTransition,
  type InvoiceStatus,
} from "@contracts/financials";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/form";
import { staffSubmitInvoiceAction, transitionInvoiceAction } from "./_actions";

export const dynamic = "force-dynamic";

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
    <Page width="default">
      <PageHeader
        title="Financials"
        backHref="/work"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/money?tab=approvals">Approvals</Link>
          </Button>
        }
      />

      <section className="mb-4 grid grid-cols-3 gap-2">
        {INVOICE_STATUSES.map((s) => (
          <div key={s} className="rounded-md border border-border bg-card p-2">
            <div className="text-meta text-muted-foreground">
              {s.replace(/_/g, " ")}
            </div>
            <div className="mt-1 font-mono text-body text-foreground">
              ${((totals[s] ?? 0) / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </section>

      <Panel className="mb-6">
        <SectionHeading>Submit invoice (staff entry)</SectionHeading>
        <form action={staffSubmitInvoiceAction} className="grid grid-cols-2 gap-2">
          <Select required name="vendorId" className="col-span-2">
            <option value="">— vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <Input name="invoiceNumber" placeholder="Invoice #" />
          <Input
            required
            name="totalCents"
            type="number"
            min={0}
            placeholder="Total (cents)"
          />
          <Textarea name="notes" rows={2} placeholder="Notes" className="col-span-2" />
          <Button type="submit" className="col-span-2">
            Submit
          </Button>
        </form>
        <p className="mt-2 text-label text-muted-foreground">
          ≤ $500 auto-approves. $500–$5K → manager review. &gt; $5K → owner.
        </p>
      </Panel>

      <ul className="divide-y divide-border/50">
        {rows.map((inv) => {
          const v = vendorById.get(inv.vendorId);
          const next = INVOICE_STATUSES.filter((s) =>
            canInvoiceTransition(inv.status as InvoiceStatus, s),
          );
          return (
            <li key={inv.id} className="px-2 py-2.5 text-body">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-foreground">
                  {v?.name ?? "(vendor)"}
                </span>
                <span className="text-label text-muted-foreground">
                  {inv.invoiceNumber ?? "no #"}
                </span>
                <span className="ml-auto font-mono text-foreground">
                  ${(Number(inv.totalCents) / 100).toFixed(2)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={toneForStatus(inv.status)}>
                  {inv.status.replace(/_/g, " ")}
                </Badge>
                {inv.submittedAt && (
                  <span className="text-label text-muted-foreground">
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
                      <Button type="submit" size="sm" variant="outline">
                        <ChevronRight className="size-3.5" />
                        {to.replace(/_/g, " ")}
                      </Button>
                    </form>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
