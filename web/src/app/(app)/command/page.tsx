import Link from "next/link";
import { loadWorkList, type WorkListFilters } from "@/lib/server/work-list";
import { loadShellSummary } from "@/lib/server/shell";
import { WorkOrderRow } from "@/components/operator/work-order-row";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Command — the coordinator/manager home. Where `/my` answers "what's on me,"
 * Command answers "what needs a person anywhere in the portfolio," as a set of
 * action queues (not vanity KPIs). Every lane reuses an existing work-list lens
 * and drills into the matching /work filter.
 */
const WO_LANES: Array<{
  key: string;
  label: string;
  filter: Partial<WorkListFilters>;
  href: string;
  dot: string;
}> = [
  {
    key: "unseen",
    label: "Not seen",
    filter: { attention: true },
    href: "/work?attention=1",
    dot: "bg-urgency-overdue",
  },
  {
    key: "tenant",
    label: "Tenant waiting",
    filter: { tenant: "not_updated" },
    href: "/work?tenant=not_updated",
    dot: "bg-urgency-blocked",
  },
  {
    key: "blocked",
    label: "Blocked",
    filter: { status: "blocked" },
    href: "/work?status=blocked",
    dot: "bg-urgency-blocked",
  },
  {
    key: "aging",
    label: "Aging · over 7 days",
    filter: { aging: true },
    href: "/work?aging=1",
    dot: "bg-urgency-overdue",
  },
];

export default async function CommandPage() {
  const [summary, ...laneResults] = await Promise.all([
    loadShellSummary(),
    ...WO_LANES.map((l) => loadWorkList({ type: "wo", ...l.filter })),
  ]);
  const lanes = WO_LANES.map((l, i) => {
    const res = laneResults[i]!;
    return { ...l, rows: res.rows, total: res.total };
  });
  const activeLanes = lanes.filter((l) => l.total > 0);

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={30_000} />
      <div className="mx-auto max-w-[1280px] px-3 pb-16 md:px-4">
        <header className="py-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Command</h1>
          <p className="text-body text-muted-foreground">
            Everything that needs a person, across the portfolio.
          </p>
        </header>

        {/* Pulse — each tile is a jump into the scoped surface. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <PulseTile label="Open" value={summary.open} href="/work?status=open" />
          <PulseTile
            label="Overdue"
            value={summary.overdue}
            href="/work?aging=1"
            alert={summary.overdue > 0}
          />
          <PulseTile
            label="Waiting"
            value={summary.blocked}
            href="/work?status=blocked"
            alert={summary.blocked > 0}
          />
          <PulseTile
            label="Sign-offs"
            value={summary.needs}
            href="/money?tab=approvals"
            alert={summary.needs > 0}
          />
          <PulseTile
            label="COIs · 30d"
            value={summary.cois30d}
            href="/vendors?tab=compliance"
            alert={summary.cois30d > 0}
          />
        </div>

        {/* Highest-priority action: decisions waiting on a person. */}
        {summary.needs > 0 && (
          <Link
            href="/money?tab=approvals"
            className="mt-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-body hover:bg-muted/40"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-urgency-overdue" />
            <span className="font-medium text-foreground">Needs decision</span>
            <span className="text-muted-foreground">
              {summary.needs} sign-off{summary.needs === 1 ? "" : "s"} waiting
            </span>
            <span className="ml-auto text-label text-muted-foreground">Review →</span>
          </Link>
        )}

        {/* Work lanes — top of each queue, with a drill-in. */}
        {activeLanes.map((l) => (
          <section key={l.key} aria-label={l.label} className="mt-5">
            <header className="flex items-center gap-2 px-4 pb-1.5">
              {l.dot && (
                <span aria-hidden className={cn("size-1.5 rounded-full", l.dot)} />
              )}
              <h2 className="text-label font-medium uppercase tracking-wider text-muted-foreground">
                {l.label}
              </h2>
              <span className="text-label tabular-nums text-muted-foreground/50">
                {l.total}
              </span>
              <Link
                href={l.href}
                className="ml-auto text-label text-muted-foreground transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            </header>
            <div>
              {l.rows.slice(0, 5).map((row) => (
                <WorkOrderRow key={row.ref} row={row} />
              ))}
            </div>
          </section>
        ))}

        {activeLanes.length === 0 && summary.needs === 0 && (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="text-sm font-medium">All lanes clear.</p>
            <p className="text-xs text-muted-foreground">
              Nothing needs attention across the portfolio right now.
            </p>
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}

function PulseTile({
  label,
  value,
  href,
  alert = false,
}: {
  label: string;
  value: number;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
    >
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          alert ? "text-urgency-overdue" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-meta uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </Link>
  );
}
