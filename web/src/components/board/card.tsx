"use client";

import { useDraggable } from "@dnd-kit/core";
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

export function Card({
  wo,
  onMove,
}: {
  wo: BoardWorkOrder;
  onMove: (to: WorkOrderStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: wo.id,
  });
  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const next = allowedNext(wo.status as WorkOrderStatus);
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded border border-neutral-200 bg-white p-2 text-sm shadow-sm ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[wo.priority as WorkOrderPriority]}`}
          aria-label={`priority ${wo.priority}`}
        />
        <span className="text-xs text-neutral-500">WO-{wo.number}</span>
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="ml-auto cursor-grab text-neutral-400 active:cursor-grabbing"
          aria-label="Drag handle"
        >
          ⋮⋮
        </button>
      </div>
      <Link
        href={`/work-orders/${wo.id}`}
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
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-xs text-neutral-500">
            Move…
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {next.map((to) => (
              <button
                key={to}
                type="button"
                onClick={() => onMove(to)}
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
