"use client";

import Link from "next/link";
import {
  allowedNext,
  type WorkOrderStatus,
  type WorkOrderPriority,
} from "@contracts/state-machines/work-order";
import type { BoardWorkOrder } from "@/lib/server/board";

const PRIORITY_DOT: Record<WorkOrderPriority, string> = {
  low: "bg-neutral-300",
  normal: "bg-sky-400",
  high: "bg-amber-500",
  urgent: "bg-rose-600",
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
      className={`cursor-default rounded border bg-white p-2 text-sm shadow-sm transition-colors ${
        selected
          ? "border-urgency-brand ring-2 ring-urgency-brand/30"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[wo.priority as WorkOrderPriority]}`}
          aria-label={`priority ${wo.priority}`}
        />
        <span className="font-mono text-[11px] tabular-nums text-neutral-500">
          WO-{wo.number}
        </span>
        {selected && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-urgency-brand">
            selected
          </span>
        )}
      </div>
      <Link
        href={`/work?d=WO-${wo.number}`}
        scroll={false}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 block text-sm leading-snug text-neutral-900 hover:underline"
      >
        {wo.title}
      </Link>
      {wo.dueAt && (
        <div className="mt-1 text-xs text-neutral-500">
          Due {new Date(wo.dueAt).toLocaleDateString()}
        </div>
      )}
      {next.length > 0 && (
        <details className="mt-2" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer select-none text-xs text-neutral-500">
            Move…
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {next.map((to) => (
              <button
                key={to}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(to);
                }}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700 active:bg-neutral-100"
              >
                → {to.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
