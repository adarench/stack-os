"use client";

import { useDroppable } from "@dnd-kit/core";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";

interface Props {
  status: WorkOrderStatus;
  count: number;
  validDrop?: boolean;
  invalidDrop?: boolean;
  children: React.ReactNode;
}

export function Column({ status, count, validDrop, invalidDrop, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const tone = invalidDrop
    ? "border-rose-300 bg-rose-50/50"
    : validDrop
      ? "border-emerald-300 bg-emerald-50/50"
      : "border-neutral-200 bg-neutral-50";
  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 snap-start flex-col rounded-lg border ${tone} ${
        isOver && validDrop ? "ring-2 ring-emerald-400" : ""
      }`}
    >
      <header className="flex items-baseline justify-between border-b border-neutral-200 px-3 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-700">
          {status.replace(/_/g, " ")}
        </h3>
        <span className="text-xs text-neutral-500">{count}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {children}
        {count === 0 && (
          <div className="rounded border border-dashed border-neutral-200 p-3 text-center text-xs text-neutral-400">
            Empty
          </div>
        )}
      </div>
    </section>
  );
}
