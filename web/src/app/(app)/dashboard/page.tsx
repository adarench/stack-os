import Link from "next/link";
import { loadDashboard } from "@/lib/server/dashboard";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function DashboardPage() {
  const d = await loadDashboard();

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-xs text-neutral-500">
          {new Date(d.generatedAt).toLocaleString()}
        </span>
        <Link
          href="/api/export/work-orders.csv"
          className="ml-auto rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
        >
          Export CSV
        </Link>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2">
        <Tile label="Open WOs" value={String(d.workOrders.open)} href="/work-orders" />
        <Tile
          label="Overdue"
          value={String(d.workOrders.overdue)}
          tone={d.workOrders.overdue > 0 ? "rose" : "neutral"}
        />
        <Tile label="New (7d)" value={String(d.workOrders.new7d)} />
        <Tile label="Closed (7d)" value={String(d.workOrders.closed7d)} />
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          By status
        </h2>
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {(Object.keys(d.workOrders.byStatus) as WorkOrderStatus[]).map((s) => (
            <li
              key={s}
              className="flex items-center justify-between rounded border border-neutral-200 bg-white px-2 py-1"
            >
              <span className="text-xs text-neutral-600">{s.replace(/_/g, " ")}</span>
              <span className="font-mono">{d.workOrders.byStatus[s]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Compliance
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="COIs expiring"
            value={String(d.compliance.coisExpiring)}
            tone={d.compliance.coisExpiring > 0 ? "amber" : "neutral"}
            href="/admin/compliance/cois"
          />
          <Tile
            label="COIs expired"
            value={String(d.compliance.coisExpired)}
            tone={d.compliance.coisExpired > 0 ? "rose" : "neutral"}
            href="/admin/compliance/cois"
          />
          <Tile
            label="Tenant ins. expiring"
            value={String(d.compliance.tenantInsExpiring)}
            tone={d.compliance.tenantInsExpiring > 0 ? "amber" : "neutral"}
            href="/admin/compliance/tenants"
          />
          <Tile
            label="Tenant ins. expired"
            value={String(d.compliance.tenantInsExpired)}
            tone={d.compliance.tenantInsExpired > 0 ? "rose" : "neutral"}
            href="/admin/compliance/tenants"
          />
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Financials
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="MTD cost" value={fmt(d.financials.mtdCostCents)} />
          <Tile label="Paid MTD" value={fmt(d.financials.invoicesPaidMtdCents)} />
          <Tile
            label="Pending approval"
            value={fmt(d.financials.invoicesPendingApprovalCents)}
            tone={d.financials.invoicesPendingApprovalCents > 0 ? "amber" : "neutral"}
            href="/admin/approvals"
          />
          <Tile
            label="Approved, not paid"
            value={fmt(d.financials.invoicesApprovedNotPaidCents)}
            href="/admin/financials"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Vendors
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Total" value={String(d.vendors.total)} href="/admin/vendors" />
          <Tile label="Active" value={String(d.vendors.active)} />
        </div>
      </section>
    </main>
  );
}

function Tile({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string;
  href?: string;
  tone?: "neutral" | "amber" | "rose";
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-300 bg-rose-50 text-rose-900"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-neutral-200 bg-white text-neutral-900";
  const inner = (
    <div className={`rounded border p-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
