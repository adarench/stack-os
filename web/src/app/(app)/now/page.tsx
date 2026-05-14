import type { ReactNode } from "react";
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
              const aside = laneAside(lane.key, rows);
              return (
                <section key={lane.key} aria-label={lane.title}>
                  <LaneHeader
                    title={lane.title}
                    count={rows.length}
                    tone={laneTone(lane.key, rows.length)}
                    aside={aside}
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

/**
 * One-line operational context for each lane — the "why does this lane
 * matter right now" caption. Calculated from the lane's items so the
 * dispatcher reads the operational truth without scanning every row.
 *
 * Reads quietly: `oldest 14d` next to `Overdue 5` says "there's a
 * fortnight-old miss buried in this list" without screaming.
 */
function laneAside(
  lane: QueueLane,
  items: QueueItem[],
): ReactNode | null {
  if (items.length === 0) return null;
  switch (lane) {
    case "overdue":
    case "blocked":
    case "needs": {
      const oldest = oldestAgeMs(items);
      if (oldest === null) return null;
      return <Caption>oldest {humanizeMs(oldest)}</Caption>;
    }
    case "today": {
      const next = items
        .map((it) => it.dueAt)
        .filter((d): d is string => !!d)
        .sort()[0];
      if (!next) return null;
      const t = new Date(next);
      const label = t
        .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        .toLowerCase()
        .replace(/\s/g, "");
      return <Caption>next {label}</Caption>;
    }
    case "inflight": {
      const unassigned = items.filter((i) => !i.ownerName).length;
      if (unassigned === 0) return null;
      return <Caption>{unassigned} unassigned</Caption>;
    }
    case "changed":
      return null;
  }
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}

function oldestAgeMs(items: QueueItem[]): number | null {
  let oldest = 0;
  const now = Date.now();
  for (const it of items) {
    const ms = now - new Date(it.lastActionAt).getTime();
    if (ms > oldest) oldest = ms;
  }
  return oldest > 0 ? oldest : null;
}

function humanizeMs(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
