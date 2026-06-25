"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { OwnerChip } from "./owner-chip";
import type { WorkRow } from "@/lib/server/work-list";
import { setStatusAction } from "@/app/(app)/_drawer/actions";
import {
  allowedNext,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";
import { workOrderTransitionLabel } from "@/lib/labels";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/**
 * Operator-console work-order row. Two lines, sentence case, no monospace.
 * The hierarchy is the customer's: WHO owns it and the issue lead; the state
 * (seen / tenant / waiting / aging) is loud and color-coded; the building is
 * secondary; the WO id is the quietest thing on the row.
 *
 *   [JR]  Fernando Reyes · Bathroom ceiling leak — 2A      ⚠ sitting 11d
 *         247 Maple Lane · Suite 2A          not seen · tenant waiting · WO-12
 */
export function WorkOrderRow({ row }: { row: WorkRow }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("d", row.ref);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [router, searchParams, row.ref]);

  const isOpen = row.isOpen !== false;
  const seen = !!row.acknowledgedAt;
  const tenantUpdated = !!row.tenantUpdatedAt;
  const waiting = row.status === "blocked";
  const urgent = row.priority === "urgent";
  const ageDays = row.openedAt ? daysSince(row.openedAt) : null;
  const aging = isOpen && ageDays !== null && ageDays >= 7;

  const where = [row.property, row.unit].filter(Boolean).join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      data-row="true"
      data-ref={row.ref}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        "group cursor-default select-none border-b border-border/50 px-2 py-2.5",
        "hover:bg-muted/40 focus:bg-muted/40 focus:outline-none",
        !isOpen && "opacity-60",
      )}
    >
      {/* Line 1 — who + what (the anchors) · loudest state on the right */}
      <div className="flex items-center gap-2.5">
        <OwnerChip name={row.ownerName} />
        <span className="shrink-0 truncate text-body font-medium text-foreground max-w-[140px]">
          {row.ownerName ?? "Unassigned"}
        </span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span className="min-w-0 flex-1 truncate text-title text-foreground">
          {row.title}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {urgent && <Badge tone="red">urgent</Badge>}
          {aging && (
            <Badge tone="red">
              <TriangleAlert className="size-3" /> sitting {ageDays}d
            </Badge>
          )}
          {!aging && waiting && isOpen && <Badge tone="amber">waiting</Badge>}
          <RowStatusAction woRef={row.ref} status={row.status} />
        </span>
      </div>

      {/* Line 2 — where (secondary) · seen/tenant words · id (quietest) */}
      <div className="mt-0.5 flex items-center gap-2 pl-[34px] text-label">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {where || "—"}
        </span>
        {isOpen ? (
          <span className="flex shrink-0 items-center gap-2">
            {seen ? (
              <span className="text-muted-foreground">seen {agoShort(row.acknowledgedAt!)}</span>
            ) : (
              <span className="font-medium text-urgency-overdue">not seen</span>
            )}
            <span aria-hidden className="text-muted-foreground/30">·</span>
            {tenantUpdated ? (
              <span className="hidden text-muted-foreground sm:inline">
                tenant told {agoShort(row.tenantUpdatedAt!)}
              </span>
            ) : (
              <span className="font-medium text-urgency-blocked">tenant waiting</span>
            )}
          </span>
        ) : (
          <span className="shrink-0 text-muted-foreground">done</span>
        )}
        <span className="shrink-0 text-meta tabular-nums text-muted-foreground/45">
          {row.ref}
        </span>
      </div>
    </div>
  );
}

/**
 * One-tap status action on the row: the primary forward step (Mark done →
 * Verify → Close, contextual to status) plus an overflow menu with the rest
 * (incl. Cancel / backtrack). Reuses the same setStatusAction the drawer uses.
 * Stops propagation so it never opens the drawer.
 */
const PRIMARY_FORWARD: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  assigned: "in_progress",
  scheduled: "in_progress",
  blocked: "in_progress",
  in_progress: "resolved",
  resolved: "verified",
  verified: "closed",
};

function RowStatusAction({ woRef, status }: { woRef: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const s = status as WorkOrderStatus;
  const nexts = allowedNext(s);
  if (nexts.length === 0) return null; // terminal (closed/cancelled)

  const primary = PRIMARY_FORWARD[s];
  const run = (to: WorkOrderStatus) =>
    startTransition(async () => {
      const r = await setStatusAction({ ref: woRef, to });
      if (r.ok) router.refresh();
    });

  return (
    <span
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {primary && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(primary)}
          className="inline-flex h-6 shrink-0 items-center rounded-md border border-border bg-background px-2 text-meta font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {workOrderTransitionLabel(primary)}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {nexts.map((to) => (
            <DropdownMenuItem
              key={to}
              disabled={pending}
              onSelect={() => run(to)}
            >
              {workOrderTransitionLabel(to)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** Loud, human state chip — tinted background so the eye lands on it. */
function Badge({
  tone,
  children,
}: {
  tone: "red" | "amber";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded px-1.5 text-meta font-semibold",
        tone === "red"
          ? "bg-urgency-overdue/12 text-urgency-overdue"
          : "bg-urgency-blocked/12 text-urgency-blocked",
      )}
    >
      {children}
    </span>
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function agoShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
