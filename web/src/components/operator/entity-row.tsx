"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { UrgencyDot, type Urgency } from "./urgency-dot";
import { OwnerChip } from "./owner-chip";
import { TimeSince } from "./time-since";

export interface EntityRowData {
  ref: string;
  title: string;
  status: string;
  /** WO priority — drives the URG/HIGH chip. Null for non-WO. */
  priority?: "low" | "normal" | "high" | "urgent" | null;
  ownerName: string | null;
  property: string | null;
  unit: string | null;
  dueAt: string | null;
  lastActionAt: string;
  lastActionText: string | null;
  urgency: Urgency;
}

/**
 * Canonical 32px row. Clicking opens the EntityDrawer via the `?d=<ref>`
 * querystring (consumed by EntityDrawer mounted at the surface root).
 *
 *   ●  WO-1043   Roof leak — 3151 Maple #2   @AR   -3d   status: blocked
 */
export function EntityRow({
  row,
  showRelativeFuture,
}: {
  row: EntityRowData;
  /** When true, show due-date relative-time (`+2h`) instead of last-action. */
  showRelativeFuture?: boolean;
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

  const timeAt =
    showRelativeFuture && row.dueAt
      ? row.dueAt
      : row.lastActionAt;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      className={cn(
        "group flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px]",
        "hover:bg-muted/40 focus:bg-muted/40 focus:outline-none",
        "md:h-8",
      )}
    >
      <UrgencyDot urgency={row.urgency} pulse={row.urgency === "overdue"} />
      <span className="w-[68px] shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {row.ref}
      </span>
      <PriorityChip priority={row.priority ?? null} />
      <span className="truncate text-foreground">
        {row.title}
        {subtitle && (
          <span className="ml-2 text-muted-foreground"> — {subtitle}</span>
        )}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <OwnerChip name={row.ownerName} />
        <TimeSince at={timeAt} />
        {row.lastActionText && (
          <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground">
            {row.lastActionText}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Priority chip — only renders for urgent/high. Normal/low/null collapse
 * to nothing so most rows stay quiet and the loud ones actually look loud.
 */
function PriorityChip({
  priority,
}: {
  priority: "low" | "normal" | "high" | "urgent" | null;
}) {
  if (priority === "urgent") {
    return (
      <span
        className={cn(
          "inline-flex h-4 shrink-0 items-center rounded-sm px-1 font-mono text-[9px] font-bold uppercase tracking-wider",
          "bg-urgency-overdue text-white",
        )}
        aria-label="Urgent priority"
      >
        URG
      </span>
    );
  }
  if (priority === "high") {
    return (
      <span
        className={cn(
          "inline-flex h-4 shrink-0 items-center rounded-sm border border-urgency-blocked px-1 font-mono text-[9px] font-semibold uppercase tracking-wider",
          "text-urgency-blocked",
        )}
        aria-label="High priority"
      >
        HIGH
      </span>
    );
  }
  return null;
}
