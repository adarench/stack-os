import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { listPendingApprovals } from "@/lib/server/approvals";
import { listInvoices } from "@/lib/server/invoices";
import { TimeSince, TimeSinceTicker } from "@/components/operator/time-since";
import { UrgencyDot } from "@/components/operator/urgency-dot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApprovalButtons } from "./approval-buttons";

export const dynamic = "force-dynamic";

type Tab = "approvals" | "invoices" | "export";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "approvals", label: "Approvals" },
  { value: "invoices", label: "Invoices" },
  { value: "export", label: "Export" },
];

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const sp = await searchParams;
  const tab: Tab =
    strOrNull(sp.tab) === "invoices"
      ? "invoices"
      : strOrNull(sp.tab) === "export"
        ? "export"
        : "approvals";

  const [approvals, invoices] = await Promise.all([
    tab === "approvals" ? listPendingApprovals() : Promise.resolve([]),
    tab === "invoices" ? listInvoices() : Promise.resolve([]),
  ]);

  return (
    <TimeSinceTicker>
      <div className="mx-auto max-w-[960px] px-3 py-3 md:px-4">
        <nav
          className="flex items-center gap-1 border-b border-border"
          aria-label="Money tabs"
        >
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Link
                key={t.value}
                href={`/money?tab=${t.value}`}
                scroll={false}
                className={cn(
                  "relative inline-flex h-9 items-center px-3 text-[12px] font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  "after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-t",
                  active ? "after:bg-foreground" : "after:bg-transparent",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {tab === "approvals" && <ApprovalsTab rows={approvals} />}
        {tab === "invoices" && <InvoicesTab rows={invoices} />}
        {tab === "export" && <ExportTab />}
      </div>
    </TimeSinceTicker>
  );
}

type Approval = Awaited<ReturnType<typeof listPendingApprovals>>[number];

function ApprovalsTab({ rows }: { rows: Approval[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Nothing waiting on approval.
      </p>
    );
  }
  const total = rows.reduce((s, r) => s + Number(r.amountCents ?? 0), 0);
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-baseline justify-between rounded-md border border-border bg-card px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Total pending
        </span>
        <span className="font-mono text-lg tabular-nums">
          ${(total / 100).toFixed(2)}
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm"
          >
            <UrgencyDot
              urgency={amountUrgency(Number(a.amountCents ?? 0))}
              className="mt-1.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium capitalize">
                  {a.reason.replace(/_/g, " ")}
                </span>
                <TimeSince at={a.createdAt.toISOString()} />
                <span className="ml-auto font-mono text-base tabular-nums">
                  ${(Number(a.amountCents ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              {a.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>
              )}
              <div className="mt-2 flex gap-2">
                <ApprovalButtons
                  approvalId={a.id}
                  amountCents={Number(a.amountCents ?? 0)}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function amountUrgency(cents: number): "overdue" | "blocked" | "muted" {
  if (cents >= 500_000) return "overdue";
  if (cents >= 100_000) return "blocked";
  return "muted";
}

type Invoice = Awaited<ReturnType<typeof listInvoices>>[number];

function InvoicesTab({ rows }: { rows: Invoice[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">No invoices recorded.</p>
    );
  }
  return (
    <ul className="mt-3 space-y-0">
      {rows.map((inv) => (
        <li
          key={inv.id}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted/40"
        >
          <UrgencyDot urgency={invoiceUrgency(inv.status)} />
          <span className="w-[100px] shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {inv.invoiceNumber ?? inv.id.slice(0, 8)}
          </span>
          <span className="flex-1 truncate">
            <span className="text-muted-foreground capitalize">
              {inv.status}
            </span>
          </span>
          <span className="font-mono text-sm tabular-nums">
            ${(Number(inv.totalCents) / 100).toFixed(2)}
          </span>
          <TimeSince at={inv.updatedAt.toISOString()} />
        </li>
      ))}
    </ul>
  );
}

function invoiceUrgency(
  status: string,
): "overdue" | "blocked" | "inflow" | "done" | "muted" {
  if (status === "rejected") return "overdue";
  if (status === "submitted") return "blocked";
  if (status === "approved") return "inflow";
  if (status === "paid") return "done";
  return "muted";
}

function ExportTab() {
  return (
    <div className="mt-3 max-w-md space-y-3">
      <p className="text-sm text-muted-foreground">
        Download the full work-order export as CSV. Includes status, due
        dates, costs, and property info.
      </p>
      <Button asChild>
        <a href="/api/export/work-orders.csv" download>
          <Download className="size-4" />
          Export work orders (CSV)
        </a>
      </Button>
    </div>
  );
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
