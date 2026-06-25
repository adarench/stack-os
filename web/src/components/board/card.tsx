"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  allowedNext,
  type WorkOrderStatus,
  type WorkOrderPriority,
} from "@contracts/state-machines/work-order";
import type { BoardWorkOrder } from "@/lib/server/board";
import { Button } from "@/components/ui/button";

const PRIORITY_DOT: Record<WorkOrderPriority, string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-urgency-inflow",
  high: "bg-urgency-blocked",
  urgent: "bg-urgency-overdue",
};

/**
 * Kanban card. Drag-drop is removed per docs/design/p9_cockpit_strategy.md
 * (PM-tool gimmick). Cards now select on click (Shift-click toggles
 * multi-select); the bottom action bar carries the batch status transition.
 * The per-card "Move…" menu stays as a single-card quick-action.
 */
export function Card({
  wo,
  selected,
  onSelect,
  onMove,
}: {
  wo: BoardWorkOrder;
  selected: boolean;
  onSelect: (id: string, shift: boolean) => void;
  onMove: (to: WorkOrderStatus) => void;
}) {
  const next = allowedNext(wo.status as WorkOrderStatus);
  return (
    <article
      data-card="true"
      data-card-id={wo.id}
      onClick={(e) => onSelect(wo.id, e.shiftKey)}
      className={`cursor-default rounded-md border bg-card p-2 text-body shadow-sm transition-colors ${
        selected
          ? "border-urgency-brand ring-2 ring-urgency-brand/30"
          : "border-border hover:border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[wo.priority as WorkOrderPriority]}`}
          aria-label={`priority ${wo.priority}`}
        />
        <span className="font-mono text-meta tabular-nums text-muted-foreground">
          WO-{wo.number}
        </span>
        {selected && (
          <span className="ml-auto font-mono text-meta text-urgency-brand">
            Selected
          </span>
        )}
      </div>
      <Link
        href={`/work?d=WO-${wo.number}`}
        scroll={false}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 block text-body leading-snug text-foreground hover:underline"
      >
        {wo.title}
      </Link>
      {wo.dueAt && (
        <div className="mt-1 text-label text-muted-foreground">
          Due {new Date(wo.dueAt).toLocaleDateString()}
        </div>
      )}
      {next.length > 0 && (
        <details className="mt-2" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer select-none text-label text-muted-foreground">
            Move…
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {next.map((to) => (
              <Button
                key={to}
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(to);
                }}
              >
                <ChevronRight />
                {to.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
