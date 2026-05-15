"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TimeSince } from "./time-since";
import { cn } from "@/lib/utils";
import { auditActionLabel } from "@/lib/labels";
import type { ActivityEvent } from "@/lib/server/activity";

/**
 * Compact "tape feed" of org-wide activity — the alive signal on /now.
 * Calm operational visibility, not chat-app chrome:
 *
 *   -2m   AR        assigned    WO-1043
 *   -4m   AR        → resolved  WO-1099
 *   -8m   system    spawned     WO-1056
 *   -12m  inngest   sweep       INS-AB12CD
 *
 * Click the ref → opens the entity drawer. Click anywhere else → no-op.
 * Five visible rows by default; the rest live behind a small scroll on
 * desktop. On mobile, collapse to three visible rows and let the operator
 * pull /now down to see more (router refresh is the read mechanism).
 */
export function ActivityStrip({ events }: { events: ActivityEvent[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const openRef = React.useCallback(
    (ref: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("d", ref);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  if (events.length === 0) {
    return (
      <div className="rounded-md px-2 py-2 font-mono text-[11px] text-muted-foreground/70">
        No activity yet — events from assignments, status changes, comments,
        and approvals stream here.
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto rounded-md"
      style={{ maxHeight: "9.5rem" /* ~6 rows */ }}
      aria-label="Recent activity"
    >
      <ul className="font-mono text-[11px] tabular-nums">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-baseline gap-2 px-2 py-[3px] text-foreground/90 hover:bg-muted/40"
          >
            <TimeSince
              at={e.at}
              className="w-12 shrink-0 text-right text-muted-foreground"
            />
            <ActorTag actor={e.actor} actorType={e.actorType} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              <ActionLabel action={e.action} diffNote={e.diffNote} />
            </span>
            {e.targetRef ? (
              <button
                type="button"
                onClick={() => openRef(e.targetRef!)}
                className="shrink-0 text-foreground hover:underline"
              >
                {e.targetRef}
              </button>
            ) : (
              <span className="shrink-0 text-muted-foreground/60">
                {e.targetType.replace(/_/g, " ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tone-coded actor handle. Two letters for staff (initials, uppercase),
 * full lowercase word for non-human actors (`system`, `inngest`, `vendor`).
 */
function ActorTag({
  actor,
  actorType,
}: {
  actor: string;
  actorType: string;
}) {
  const isHuman = actorType === "user" || actorType === "vendor_user";
  return (
    <span
      className={cn(
        "w-12 shrink-0 truncate",
        isHuman ? "text-foreground" : "text-muted-foreground/80",
      )}
    >
      {isHuman ? `@${actor}` : actor}
    </span>
  );
}

/**
 * Humanize the audit verb. Centralized in lib/labels so the activity
 * strip, the drawer activity tab, and any future timeline use the same
 * phrasing.
 */
function ActionLabel({
  action,
  diffNote,
}: {
  action: string;
  diffNote: string | null;
}) {
  return (
    <>
      {auditActionLabel(action)}
      {diffNote && <span className="ml-1 text-foreground/80">{diffNote}</span>}
    </>
  );
}
