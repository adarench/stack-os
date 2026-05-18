"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { UrgencyDot, type Urgency } from "./urgency-dot";
import { OwnerChip } from "./owner-chip";
import { TimeSince } from "./time-since";
import { workOrderStatusLabel } from "@/lib/labels";

export interface EntityRowData {
  ref: string;
  title: string;
  status: string;
  /** WO priority — drives the URG/HIGH chip + the left severity rail. */
  priority?: "low" | "normal" | "high" | "urgent" | null;
  ownerName: string | null;
  property: string | null;
  unit: string | null;
  dueAt: string | null;
  lastActionAt: string;
  lastActionText: string | null;
  urgency: Urgency;
  /** Open + untouched for 7d+. Drives the stale chip. */
  aged?: boolean;
}

/**
 * Per-lane tail variant. Each lane has a different *primary signal*; the
 * uniform owner+time+status trio is gone. The dispatcher's eye lands on
 * the one thing that matters for the lane they're triaging.
 *
 *   overdue  → big red age chip; owner secondary
 *   blocked  → blocker reason chip; owner secondary
 *   today    → scheduled time, owner secondary
 *   inflight → owner chip with initials, time secondary
 *   needs    → pending duration chip (red after 24h)
 *   changed  → status verb (already-readable phrasing)
 *   default  → owner + time + status (the catalog tail, /work flat list)
 */
export type TailMode =
  | "overdue"
  | "blocked"
  | "today"
  | "inflight"
  | "needs"
  | "changed"
  | "default";

/**
 * Canonical row. Composition reflects pressure:
 *  - urgent/overdue/blocked rows show a 3px colored bar on the left edge
 *    so the silhouette differs from routine rows at peripheral-vision
 *    distance.
 *  - the right-side "tail" is ONE signal, varied per lane.
 *
 *      [bar] ●  WO-1043  URG  Roof leak — 3151 Maple #2          {tail}
 */
export function EntityRow({
  row,
  showRelativeFuture,
  tailMode = "default",
}: {
  row: EntityRowData;
  showRelativeFuture?: boolean;
  tailMode?: TailMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("d", row.ref);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [router, searchParams, row.ref]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  const subtitle =
    [row.property, row.unit].filter(Boolean).join(" · ") || null;

  const bar = severityBarTone(row);
  const titleEmphasis = row.priority === "urgent" || row.urgency === "overdue";

  return (
    <div
      data-row="true"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      className={cn(
        "group relative flex h-8 cursor-default select-none items-center gap-2 rounded-md pl-2 pr-2 text-[13px]",
        "hover:bg-muted/40 focus:bg-muted/40 focus:outline-none focus-visible:bg-muted/60",
        bar !== null && "pl-[10px]",
      )}
    >
      {bar !== null && (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full",
            bar === "red" && "bg-urgency-overdue",
            bar === "amber" && "bg-urgency-blocked",
          )}
        />
      )}
      <UrgencyDot urgency={row.urgency} pulse={row.urgency === "overdue"} />
      <span className="w-[68px] shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {row.ref}
      </span>
      <PriorityChip priority={row.priority ?? null} />
      <span
        className={cn(
          "truncate",
          titleEmphasis ? "font-medium text-foreground" : "text-foreground",
        )}
      >
        {row.title}
        {subtitle && (
          <span className="ml-2 text-muted-foreground">— {subtitle}</span>
        )}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Tail row={row} mode={tailMode} showRelativeFuture={!!showRelativeFuture} />
      </span>
    </div>
  );
}

/* -------------------- severity bar -------------------- */

type BarTone = "red" | "amber" | null;

function severityBarTone(row: EntityRowData): BarTone {
  if (row.priority === "urgent") return "red";
  if (row.urgency === "overdue") return "red";
  if (row.urgency === "blocked") return "amber";
  if (row.priority === "high") return "amber";
  return null;
}

/* -------------------- tail variants -------------------- */

function Tail({
  row,
  mode,
  showRelativeFuture,
}: {
  row: EntityRowData;
  mode: TailMode;
  showRelativeFuture: boolean;
}) {
  switch (mode) {
    case "overdue":
      return <OverdueTail row={row} />;
    case "blocked":
      return <BlockedTail row={row} />;
    case "today":
      return <TodayTail row={row} />;
    case "inflight":
      return <InflightTail row={row} />;
    case "needs":
      return <NeedsTail row={row} />;
    case "changed":
      return <ChangedTail row={row} />;
    case "default":
    default:
      return <DefaultTail row={row} showRelativeFuture={showRelativeFuture} />;
  }
}

/** Time since the WO went overdue, in red. Owner shown small + muted. */
function OverdueTail({ row }: { row: EntityRowData }) {
  const anchor = row.dueAt ?? row.lastActionAt;
  return (
    <>
      {row.ownerName && (
        <span className="hidden lg:inline max-w-[140px] truncate text-[10px] text-muted-foreground">
          {row.ownerName}
        </span>
      )}
      <TimeSince
        at={anchor}
        className="font-mono text-[11px] tabular-nums text-urgency-overdue"
      />
    </>
  );
}

/** What's blocking. Falls back to the time chip if no reason. */
function BlockedTail({ row }: { row: EntityRowData }) {
  const reason = blockerReason(row);
  return (
    <>
      {row.ownerName && (
        <span className="hidden lg:inline max-w-[120px] truncate text-[10px] text-muted-foreground">
          {row.ownerName}
        </span>
      )}
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-urgency-blocked">
        {reason}
      </span>
    </>
  );
}

/** Scheduled time for today's lane. */
function TodayTail({ row }: { row: EntityRowData }) {
  if (!row.dueAt) {
    return <TimeSince at={row.lastActionAt} />;
  }
  const t = new Date(row.dueAt);
  const label = t
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(/\s/g, "");
  return (
    <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
      {label}
    </span>
  );
}

/** Owner chip + initials larger; time is secondary. */
function InflightTail({ row }: { row: EntityRowData }) {
  return (
    <>
      <TimeSince at={row.lastActionAt} className="text-muted-foreground/80" />
      {row.ownerName ? (
        <span className="flex items-center gap-1.5">
          <OwnerChip name={row.ownerName} />
          <span className="hidden lg:inline max-w-[140px] truncate text-[11px] text-foreground">
            {row.ownerName}
          </span>
        </span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-wider text-urgency-blocked">
          unassigned
        </span>
      )}
    </>
  );
}

/** Pending duration, red after 24h. */
function NeedsTail({ row }: { row: EntityRowData }) {
  const ageMs = Date.now() - new Date(row.lastActionAt).getTime();
  const tone =
    ageMs > 24 * 60 * 60 * 1000
      ? "text-urgency-overdue"
      : ageMs > 8 * 60 * 60 * 1000
        ? "text-urgency-blocked"
        : "text-muted-foreground";
  return (
    <span className={cn("font-mono text-[11px] tabular-nums", tone)}>
      {humanize(ageMs)}
    </span>
  );
}

/** Action verb (what just changed). */
function ChangedTail({ row }: { row: EntityRowData }) {
  return (
    <>
      <TimeSince at={row.lastActionAt} className="text-muted-foreground/80" />
      {row.lastActionText && (
        <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground">
          {row.lastActionText}
        </span>
      )}
    </>
  );
}

/** The /work flat-list catalog tail — owner + time + status. */
function DefaultTail({
  row,
  showRelativeFuture,
}: {
  row: EntityRowData;
  showRelativeFuture: boolean;
}) {
  const timeAt =
    showRelativeFuture && row.dueAt ? row.dueAt : row.lastActionAt;
  return (
    <>
      {row.aged && (
        <span
          aria-label="No activity in 7+ days"
          title="No activity in 7+ days"
          className="hidden md:inline shrink-0 font-mono text-[10px] uppercase tracking-wider text-urgency-blocked/80"
        >
          stale
        </span>
      )}
      <OwnerChip name={row.ownerName} />
      <TimeSince at={timeAt} />
      {row.lastActionText && (
        <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground">
          {row.lastActionText}
        </span>
      )}
    </>
  );
}

/* -------------------- helpers -------------------- */

/**
 * Read a "what's blocking" label from the row's existing status text. WOs
 * get an editorial mapping; non-WOs fall back to "blocked". The eventual
 * fix is a `blocker_reason` field on the work-order model; until then this
 * is the best we can do at the row level.
 */
function blockerReason(row: EntityRowData): string {
  const t = (row.lastActionText ?? "").toLowerCase();
  if (t.includes("approval")) return "needs sign-off";
  if (t.includes("vendor")) return "waiting on vendor";
  if (t.includes("part")) return "waiting on parts";
  if (t.includes("tenant")) return "waiting on tenant";
  if (t.includes("coi") || t.includes("insurance")) return "insurance gap";
  return workOrderStatusLabel(row.status) || "blocked";
}

function humanize(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

/**
 * Priority chip — only renders for urgent/high. Normal/low collapse to
 * nothing so most rows stay quiet and the loud ones look loud.
 */
function PriorityChip({
  priority,
}: {
  priority: "low" | "normal" | "high" | "urgent" | null;
}) {
  if (priority === "urgent") {
    return (
      <span
        className="inline-flex h-4 shrink-0 items-center rounded-sm bg-urgency-overdue px-1 font-mono text-[9px] font-bold uppercase tracking-wider text-white"
        aria-label="Urgent priority"
      >
        URG
      </span>
    );
  }
  if (priority === "high") {
    return (
      <span
        className="inline-flex h-4 shrink-0 items-center rounded-sm border border-urgency-blocked px-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-urgency-blocked"
        aria-label="High priority"
      >
        HIGH
      </span>
    );
  }
  return null;
}
