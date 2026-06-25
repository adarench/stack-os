"use client";

import type { WorkOrderStatus } from "@contracts/state-machines/work-order";

interface Props {
  status: WorkOrderStatus;
  count: number;
  selectedCount?: number;
  children: React.ReactNode;
}

/**
 * Kanban column. Drag-drop is removed per docs/design/p9_cockpit_strategy.md.
 * The column header shows total cards and (when active) selected count so
 * the operator can see at a glance how much they've staged for a batch move.
 */
export function Column({ status, count, selectedCount = 0, children }: Props) {
  return (
    <section className="flex w-72 shrink-0 snap-start flex-col rounded-lg border border-border bg-muted/50">
      <header className="flex items-baseline justify-between border-b border-border px-3 py-2">
        <h3 className="text-meta font-medium uppercase tracking-wider text-foreground">
          {status.replace(/_/g, " ")}
        </h3>
        <span className="font-mono text-meta tabular-nums text-muted-foreground">
          {selectedCount > 0 ? `${selectedCount}/${count}` : count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {children}
        {count === 0 && (
          <div className="rounded border border-dashed border-border p-3 text-center text-meta text-muted-foreground">
            Empty
          </div>
        )}
      </div>
    </section>
  );
}
