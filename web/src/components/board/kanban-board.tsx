"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  WORK_ORDER_STATUSES,
  canTransition,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";
import { moveWorkOrderAction } from "@/app/(app)/work-orders/_actions";
import type { BoardWorkOrder } from "@/lib/server/board";
import { Column } from "./column";
import { Card } from "./card";

interface Props {
  initial: Record<WorkOrderStatus, BoardWorkOrder[]>;
  columns: WorkOrderStatus[];
}

export function KanbanBoard({ initial, columns }: Props) {
  const [byStatus, setByStatus] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const draggingFrom = useMemo<WorkOrderStatus | null>(() => {
    if (!draggingId) return null;
    for (const s of WORK_ORDER_STATUSES) {
      if (byStatus[s]?.some((w) => w.id === draggingId)) return s;
    }
    return null;
  }, [draggingId, byStatus]);

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
    setError(null);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const id = String(e.active.id);
    const to = String(overId) as WorkOrderStatus;
    const from = draggingFrom;
    if (!from || from === to) return;
    if (!canTransition(from, to)) {
      setError(`Cannot move ${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`);
      return;
    }
    // Optimistic update
    setByStatus((prev) => {
      const card = prev[from].find((w) => w.id === id);
      if (!card) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((w) => w.id !== id),
        [to]: [{ ...card, status: to }, ...prev[to]],
      };
    });
    startTransition(async () => {
      const result = await moveWorkOrderAction(id, to);
      if (!result.ok) {
        // Roll back
        setByStatus((prev) => {
          const card = prev[to].find((w) => w.id === id);
          if (!card) return prev;
          return {
            ...prev,
            [to]: prev[to].filter((w) => w.id !== id),
            [from]: [{ ...card, status: from }, ...prev[from]],
          };
        });
        setError(result.error);
      }
    });
  }

  function moveByMenu(id: string, from: WorkOrderStatus, to: WorkOrderStatus) {
    if (!canTransition(from, to)) return;
    setByStatus((prev) => {
      const card = prev[from].find((w) => w.id === id);
      if (!card) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((w) => w.id !== id),
        [to]: [{ ...card, status: to }, ...prev[to]],
      };
    });
    startTransition(async () => {
      const result = await moveWorkOrderAction(id, to);
      if (!result.ok) {
        setByStatus((prev) => {
          const card = prev[to].find((w) => w.id === id);
          if (!card) return prev;
          return {
            ...prev,
            [to]: prev[to].filter((w) => w.id !== id),
            [from]: [{ ...card, status: from }, ...prev[from]],
          };
        });
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-2 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {error}
        </div>
      )}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4">
          {columns.map((status) => {
            const cards = byStatus[status] ?? [];
            const validDrop =
              draggingFrom !== null && draggingFrom !== status && canTransition(draggingFrom, status);
            const invalidDrop =
              draggingFrom !== null && draggingFrom !== status && !canTransition(draggingFrom, status);
            return (
              <Column
                key={status}
                status={status}
                count={cards.length}
                validDrop={validDrop}
                invalidDrop={invalidDrop}
              >
                {cards.map((w) => (
                  <Card key={w.id} wo={w} onMove={(to) => moveByMenu(w.id, status, to)} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
