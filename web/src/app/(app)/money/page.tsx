import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { listPendingApprovals } from "@/lib/server/approvals";
import { listInvoicesEnriched, type InvoiceRow } from "@/lib/server/invoices";
import { TimeSince, TimeSinceTicker } from "@/components/operator/time-since";
import { UrgencyDot } from "@/components/operator/urgency-dot";
import { OwnerChip } from "@/components/operator/owner-chip";
import { cn } from "@/lib/utils";
import { approvalReasonLabel } from "@/lib/labels";
import { ApprovalButtons } from "./approval-buttons";

export const dynamic = "force-dynamic";

type Tab = "approvals" | "invoices";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "approvals", label: "Sign-offs" },
  { value: "invoices", label: "Vendor billing" },
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
  const tab: Tab = strOrNull(sp.tab) === "invoices" ? "invoices" : "approvals";

  const [approvals, invoices] = await Promise.all([
    tab === "approvals" ? listPendingApprovals() : Promise.resolve([]),
    tab === "invoices" ? listInvoicesEnriched() : Promise.resolve([]),
  ]);

  return (
    <TimeSinceTicker>
      <div className="mx-auto flex h-full max-w-[1080px] flex-col px-3 py-3 md:px-4">
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
          <a
            href="/api/export/work-orders.csv"
            download
            className="ml-auto inline-flex h-9 items-center gap-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
            aria-label="Export work orders to CSV"
          >
            <Download className="size-3.5" />
            Export CSV
          </a>
        </nav>

        {tab === "approvals" && <ApprovalsTab rows={approvals} />}
        {tab === "invoices" && <InvoicesTab rows={invoices} />}
      </div>
    </TimeSinceTicker>
  );
}

type Approval = Awaited<ReturnType<typeof listPendingApprovals>>[number];

function ApprovalsTab({ rows }: { rows: Approval[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        No decisions outstanding. Invoices or estimates above threshold land
        here when they need a sign-off.
      </p>
    );
  }
  const total = rows.reduce((s, r) => s + Number(r.amountCents ?? 0), 0);
  const oldestMs = rows.reduce((max, r) => {
    const ms = Date.now() - r.createdAt.getTime();
    return ms > max ? ms : max;
  }, 0);
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-baseline gap-3 rounded-md border border-border bg-card px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Total pending
        </span>
        <span className="font-mono text-lg tabular-nums">
          ${(total / 100).toFixed(2)}
        </span>
        {oldestMs > 0 && (
          <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
            oldest {humanizeMs(oldestMs)}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm"
          >
            <UrgencyDot
              urgency={approvalUrgency(a.createdAt, Number(a.amountCents ?? 0))}
              className="mt-1.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">
                  {approvalReasonLabel(a.reason)}
                </span>
                {a.woRef && (
                  <Link
                    href={`?d=${a.woRef}`}
                    scroll={false}
                    data-ref={a.woRef}
                    className="font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                  >
                    {a.woRef}
                  </Link>
                )}
                <PendingChip createdAt={a.createdAt} />
                <span className="ml-auto font-mono text-base tabular-nums">
                  ${(Number(a.amountCents ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              {a.woTitle && (
                <p className="mt-0.5 flex items-baseline gap-2 truncate text-xs text-muted-foreground">
                  <span className="truncate">{a.woTitle}</span>
                  <WoConsequenceChip
                    status={a.woStatus}
                    dueAt={a.woDueAt}
                  />
                </p>
              )}
              {a.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <ApprovalButtons
                  approvalId={a.id}
                  amountCents={Number(a.amountCents ?? 0)}
                />
                {a.vendorStressed !== null && a.vendorStressed >= 2 && (
                  <span
                    className={cn(
                      "ml-auto font-mono text-[10px] uppercase tracking-wider",
                      a.vendorStressed >= 4
                        ? "text-urgency-overdue"
                        : "text-urgency-blocked",
                    )}
                  >
                    vendor: {a.vendorStressed} stressed
                  </span>
                )}
                {a.woOwnerName && (
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] text-muted-foreground",
                      a.vendorStressed !== null && a.vendorStressed >= 2
                        ? ""
                        : "ml-auto",
                    )}
                  >
                    holding
                    <OwnerChip name={a.woOwnerName} />
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Approval row's primary urgency cue. Amount alone misses the operational
 * truth: a $300 decision pending for 3 days is a problem too. SLA aging
 * always wins over amount.
 */
function approvalUrgency(
  createdAt: Date,
  cents: number,
): "overdue" | "blocked" | "muted" {
  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return "overdue";
  if (ageMs > 8 * 60 * 60 * 1000) return "blocked";
  if (cents >= 500_000) return "overdue";
  if (cents >= 100_000) return "blocked";
  return "muted";
}

/**
 * Consequence chip — what's actually waiting on this decision. Reads like
 * a dispatcher's footnote: "WO blocked", "WO overdue 3d". Silent when the
 * underlying WO isn't in a state where the delay matters.
 */
function WoConsequenceChip({
  status,
  dueAt,
}: {
  status: string | null;
  dueAt: Date | null;
}) {
  if (!status) return null;

  if (dueAt && dueAt.getTime() < Date.now()) {
    const ms = Date.now() - dueAt.getTime();
    return (
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-urgency-overdue">
        overdue {humanizeMs(ms)}
      </span>
    );
  }

  if (status === "blocked") {
    return (
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-urgency-blocked">
        WO blocked
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
        in progress
      </span>
    );
  }

  return null;
}

/**
 * "pending Xh" chip — the SLA aging signal. Color climbs as the decision
 * sits unmade. Approvers learn to recognize "pending 14h" as a soft prompt
 * and "pending 2d" as a hard one.
 */
function PendingChip({ createdAt }: { createdAt: Date }) {
  const ageMs = Date.now() - createdAt.getTime();
  const tone =
    ageMs > 24 * 60 * 60 * 1000
      ? "text-urgency-overdue"
      : ageMs > 8 * 60 * 60 * 1000
        ? "text-urgency-blocked"
        : "text-muted-foreground";
  return (
    <span
      title={createdAt.toLocaleString()}
      className={cn("font-mono text-[11px] tabular-nums", tone)}
    >
      pending {humanizeMs(ageMs)}
    </span>
  );
}

function humanizeMs(absMs: number): string {
  const m = Math.round(absMs / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function InvoicesTab({ rows }: { rows: InvoiceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        No vendor bills on file. Submissions land here for review and payment.
      </p>
    );
  }

  // Group by vendor so the operator's mental model ("what's outstanding
  // to Stark?") matches the layout.
  const byVendor = new Map<string, InvoiceRow[]>();
  for (const r of rows) {
    const key = r.vendorName ?? "Unknown vendor";
    const list = byVendor.get(key);
    if (list) list.push(r);
    else byVendor.set(key, [r]);
  }
  const vendorOrder = Array.from(byVendor.entries()).sort((a, b) => {
    const outstandingA = a[1].filter(isOutstanding).length;
    const outstandingB = b[1].filter(isOutstanding).length;
    if (outstandingA !== outstandingB) return outstandingB - outstandingA;
    return a[0].localeCompare(b[0]);
  });

  return (
    <div className="mt-3 space-y-4">
      {vendorOrder.map(([vendor, items]) => {
        const outstandingCents = items
          .filter(isOutstanding)
          .reduce((s, r) => s + Number(r.totalCents), 0);
        const oldestOutstanding = items
          .filter(isOutstanding)
          .reduce<number | null>((max, r) => {
            const at = r.submittedAt ?? r.updatedAt;
            if (!at) return max;
            const ms = Date.now() - at.getTime();
            return max === null || ms > max ? ms : max;
          }, null);
        return (
          <section key={vendor}>
            <header className="flex items-baseline gap-2 px-2 pb-1 pt-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                {vendor}
              </h3>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {items.length} {items.length === 1 ? "bill" : "bills"}
              </span>
              {outstandingCents > 0 && (
                <span className="ml-auto font-mono text-[11px] tabular-nums text-urgency-blocked">
                  ${(outstandingCents / 100).toFixed(0)} outstanding
                  {oldestOutstanding && oldestOutstanding > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      · oldest {humanizeMs(oldestOutstanding)}
                    </span>
                  )}
                </span>
              )}
            </header>
            <ul className="space-y-0">
              {items.map((inv) => (
                <li
                  key={inv.id}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted/40"
                >
                  <UrgencyDot urgency={invoiceUrgency(inv.status)} />
                  <span className="w-[100px] shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {inv.invoiceNumber ?? inv.id.slice(0, 8)}
                  </span>
                  {inv.workOrderRef && (
                    <Link
                      href={`?d=${inv.workOrderRef}`}
                      scroll={false}
                      data-ref={inv.workOrderRef}
                      className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                    >
                      {inv.workOrderRef}
                    </Link>
                  )}
                  <span className="flex-1 truncate text-muted-foreground">
                    {invoiceStatusLabel(inv.status)}
                    {inv.approverName && inv.status !== "submitted" && (
                      <span className="ml-1 text-muted-foreground/70">
                        by {inv.approverName}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    ${(Number(inv.totalCents) / 100).toFixed(2)}
                  </span>
                  <TimeSince at={(inv.submittedAt ?? inv.updatedAt).toISOString()} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function isOutstanding(r: InvoiceRow): boolean {
  return r.status === "submitted" || r.status === "disputed";
}

function invoiceUrgency(
  status: string,
): "overdue" | "blocked" | "inflow" | "done" | "muted" {
  if (status === "disputed") return "overdue";
  if (status === "submitted") return "blocked";
  if (status === "approved") return "inflow";
  if (status === "paid") return "done";
  return "muted";
}

function invoiceStatusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "awaiting review";
    case "approved":
      return "approved · awaiting payment";
    case "paid":
      return "paid";
    case "disputed":
      return "disputed";
    case "draft":
      return "draft";
    case "void":
      return "void";
    default:
      return status;
  }
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
