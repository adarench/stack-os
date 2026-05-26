import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import {
  loadQueueLane,
  loadQueueSummary,
  type QueueItem,
  type QueueLane,
} from "@/lib/server/queue";
import { loadRecentActivity } from "@/lib/server/activity";
import { ActivityStrip } from "@/components/operator/activity-strip";
import { LaneHeader, laneTone } from "@/components/operator/lane-header";
import { EntityRow, type TailMode } from "@/components/operator/entity-row";
import {
  laneBgTint,
  laneProjection,
  oldestRef as pickOldestRef,
  verbSummary,
} from "@/lib/operator/lane-projection";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { LiveIndicator } from "@/components/operator/live-indicator";
import { cn } from "@/lib/utils";
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

  // Fan out: summary + six lanes + recent activity in parallel. Each
  // query is RLS-scoped.
  const [summary, needs, overdue, blocked, today, inflight, changed, activity] =
    await Promise.all([
      loadQueueSummary(),
      loadQueueLane("needs"),
      loadQueueLane("overdue"),
      loadQueueLane("blocked"),
      loadQueueLane("today"),
      loadQueueLane("inflight"),
      loadQueueLane("changed"),
      loadRecentActivity(12),
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
      <div className="mx-auto max-w-[840px] px-3 py-4 md:px-4">
        <header className="mb-2 flex items-baseline justify-between">
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Now
          </h1>
          <LiveIndicator />
        </header>

        <ActivityStrip events={activity} />

        {allEmpty ? (
          <EmptyAllClear />
        ) : (
          <div className="mt-3 space-y-0">
            {LANES.map((lane) => {
              const rows = items[lane.key];
              if (rows.length === 0) return null;
              return (
                <Lane
                  key={lane.key}
                  laneKey={lane.key}
                  title={lane.title}
                  rows={rows}
                  futureTime={lane.futureTime ?? false}
                />
              );
            })}
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}

/**
 * A /now lane block. Lanes carry their own visual weight: overdue gets a
 * top border tinted red and a bolder title. Just-changed collapses to the
 * first 3 rows with a "show more" affordance — the lane exists for
 * peripheral awareness, not deep work.
 */
function Lane({
  laneKey,
  title,
  rows,
  futureTime,
}: {
  laneKey: QueueLane;
  title: string;
  rows: QueueItem[];
  futureTime: boolean;
}) {
  const tone = laneTone(laneKey, rows.length);
  const aside = laneAside(laneKey, rows);
  const visibleRows =
    laneKey === "changed" && rows.length > 3 ? rows.slice(0, 3) : rows;
  const hidden = rows.length - visibleRows.length;

  const tailMode: TailMode = laneToTail(laneKey);
  // Emphasis is tone-driven — any lane whose count crosses red/amber
  // threshold lifts its title, not just the static overdue/blocked pair.
  // This is what surfaces NEEDS YOU as a *demand for action*, not a list.
  const emphasized = tone === "red" || tone === "amber";

  const laneTintClass = laneBgTint(laneKey);
  // Single oldest OVERDUE row gets the pulse; the rest go silent so the
  // lane doesn't strobe.
  const oldestRef = laneKey === "overdue" ? pickOldestRef(rows) : null;

  return (
    <section
      aria-label={title}
      className={cn(
        "border-t border-border first:border-t-0",
        laneKey === "overdue" && "border-urgency-overdue/30",
        laneKey === "blocked" && "border-urgency-blocked/30",
        laneTintClass,
      )}
    >
      <LaneHeader
        title={title}
        count={rows.length}
        tone={tone}
        emphasized={emphasized}
        aside={aside}
      />
      <div className="space-y-0">
        {visibleRows.map((row) => (
          <EntityRow
            key={`${row.type}-${row.ref}`}
            row={row}
            showRelativeFuture={futureTime}
            tailMode={tailMode}
            projection={laneProjection(laneKey, row, oldestRef)}
          />
        ))}
        {hidden > 0 && (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">
            <Link
              href={`/work?recent=24h`}
              className="hover:text-foreground"
            >
              show {hidden} more recent changes →
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}


function laneToTail(laneKey: QueueLane): TailMode {
  switch (laneKey) {
    case "overdue":
      return "overdue";
    case "blocked":
      return "blocked";
    case "today":
      return "today";
    case "inflight":
      return "inflight";
    case "needs":
      return "needs";
    case "changed":
      return "changed";
  }
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
      const unassigned = items.filter((i) => !i.ownerName).length;
      if (!next && unassigned === 0) return null;
      const parts: string[] = [];
      if (next) {
        const t = new Date(next);
        const label = t
          .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
          .toLowerCase()
          .replace(/\s/g, "");
        parts.push(`next ${label}`);
      }
      if (unassigned > 0) parts.push(`${unassigned} unassigned`);
      return <Caption>{parts.join(" · ")}</Caption>;
    }
    case "inflight": {
      const unassigned = items.filter((i) => !i.ownerName).length;
      const oldest = oldestAgeMs(items);
      const parts: string[] = [];
      if (unassigned > 0) parts.push(`${unassigned} unassigned`);
      if (oldest !== null && oldest > 24 * 60 * 60 * 1000) {
        parts.push(`oldest active ${humanizeMs(oldest)}`);
      }
      if (parts.length === 0) return null;
      return <Caption>{parts.join(" · ")}</Caption>;
    }
    case "changed": {
      // Action-verb summary — "8 resolved · 4 assigned · 2 status" lets the
      // operator see the shape of the morning without reading rows.
      const summary = verbSummary(items);
      return summary ? <Caption>{summary}</Caption> : null;
    }
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
