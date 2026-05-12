import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  loadQueueLane,
  loadQueueSummary,
  type QueueItem,
  type QueueLane,
} from "@/lib/server/queue";
import { PulseStrip } from "@/components/operator/pulse-strip";
import { LaneHeader, laneTone } from "@/components/operator/lane-header";
import { EntityRow } from "@/components/operator/entity-row";
import { EntityDrawer } from "@/components/operator/entity-drawer";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { LiveIndicator } from "@/components/operator/live-indicator";
import { EmptyAllClear } from "./empty-all-clear";

export const dynamic = "force-dynamic";

interface LaneSpec {
  key: QueueLane;
  title: string;
  /** When true, rows show their due-date as the right-side relative time. */
  futureTime?: boolean;
}

const LANES: LaneSpec[] = [
  { key: "needs", title: "Needs you" },
  { key: "overdue", title: "Overdue" },
  { key: "blocked", title: "Blocked" },
  { key: "today", title: "Today", futureTime: true },
  { key: "inflight", title: "In-flight" },
  { key: "changed", title: "Just changed" },
];

export default async function NowPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  // Fan out: summary + six lanes in parallel. Each query is RLS-scoped.
  const [summary, needs, overdue, blocked, today, inflight, changed] =
    await Promise.all([
      loadQueueSummary(),
      loadQueueLane("needs"),
      loadQueueLane("overdue"),
      loadQueueLane("blocked"),
      loadQueueLane("today"),
      loadQueueLane("inflight"),
      loadQueueLane("changed"),
    ]);

  const items: Record<QueueLane, QueueItem[]> = {
    needs,
    overdue,
    blocked,
    today,
    inflight,
    changed,
  };

  const allEmpty = LANES.every((l) => items[l.key].length === 0);

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={15_000} />
      <div className="mx-auto max-w-[720px] px-3 py-4 md:px-4">
        <header className="mb-2 flex items-baseline justify-between">
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Now
          </h1>
          <LiveIndicator />
        </header>
        <PulseStrip
          stats={[
            {
              label: "Open WOs",
              value: summary.pulse.openWOs,
              href: "/work?status=open",
            },
            {
              label: "Overdue",
              value: summary.pulse.overdue,
              href: "/work?due=overdue",
              alert: summary.pulse.overdue > 0,
            },
            {
              label: "COIs expiring 30d",
              value: summary.pulse.coisExpiring30d,
              href: "/compliance?tab=cois&filter=expiring",
              alert: summary.pulse.coisExpiring30d > 0,
            },
            {
              label: "Approvals pending",
              value: summary.pulse.pendingApprovals,
              href: "/money?tab=approvals",
              alert: summary.pulse.pendingApprovals > 0,
            },
          ]}
        />

        {allEmpty ? (
          <EmptyAllClear />
        ) : (
          <div className="mt-4 space-y-1">
            {LANES.map((lane) => {
              const rows = items[lane.key];
              if (rows.length === 0) return null;
              return (
                <section key={lane.key} aria-label={lane.title}>
                  <LaneHeader
                    title={lane.title}
                    count={rows.length}
                    tone={laneTone(lane.key, rows.length)}
                  />
                  <div className="space-y-0">
                    {rows.map((row) => (
                      <EntityRow
                        key={`${row.type}-${row.ref}`}
                        row={row}
                        showRelativeFuture={lane.futureTime ?? false}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <EntityDrawer />
    </TimeSinceTicker>
  );
}
