"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, ChevronRight } from "lucide-react";
import {
  allowedNext,
  canTransition,
  type InspectionStatus,
} from "@contracts/state-machines/inspection";
import type { BoardInspection } from "@/lib/server/inspection-board";
import { moveInspectionAction } from "@/app/(app)/inspections/_actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Board = Record<InspectionStatus, BoardInspection[]>;

interface Props {
  initial: Board;
  columns: InspectionStatus[];
}

const kindLabel = (k: string) =>
  k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
const statusLabel = (s: string) => s.replace(/_/g, " ");

/**
 * Trello-style inspection board. Cards drag between status columns (dnd-kit),
 * with a click/keyboard "Move…" menu as an accessible fallback. Dropping a card
 * into Completed runs the server-side completeInspection (which spawns work
 * orders for failed findings); the toast surfaces how many were created.
 */
export function InspectionBoard({ initial, columns }: Props) {
  const [board, setBoard] = React.useState<Board>(initial);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const cardById = React.useMemo(() => {
    const m = new Map<string, BoardInspection>();
    for (const s of Object.keys(board) as InspectionStatus[]) {
      for (const c of board[s] ?? []) m.set(c.id, c);
    }
    return m;
  }, [board]);

  const move = React.useCallback(
    (id: string, from: InspectionStatus, to: InspectionStatus) => {
      if (from === to) return;
      if (!canTransition(from, to)) {
        toast.error(`Can't move to ${statusLabel(to)} from ${statusLabel(from)}.`);
        return;
      }
      const snapshot = board;
      setBoard((prev) => {
        const card = prev[from]?.find((c) => c.id === id);
        if (!card) return prev;
        const next: Board = { ...prev, [from]: prev[from].filter((c) => c.id !== id) };
        // `cancelled` isn't a visible column — the card just leaves the board.
        if (next[to]) next[to] = [{ ...card, status: to }, ...prev[to]];
        return next;
      });
      startTransition(async () => {
        const r = await moveInspectionAction(id, to);
        if (!r.ok) {
          setBoard(snapshot);
          toast.error(`Couldn't move: ${r.error}`);
          return;
        }
        if (to === "completed") {
          toast.success(
            r.spawned > 0
              ? `Inspection completed — ${r.spawned} work order${r.spawned === 1 ? "" : "s"} created.`
              : "Inspection completed.",
          );
        }
      });
    },
    [board],
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const from = active.data.current?.from as InspectionStatus | undefined;
    const to = over.id as InspectionStatus;
    if (from) move(String(active.id), from, to);
  };

  const activeCard = activeId ? cardById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-20">
        {columns.map((status) => (
          <BoardColumn key={status} status={status} count={(board[status] ?? []).length}>
            {(board[status] ?? []).map((ins) => (
              <BoardCard key={ins.id} ins={ins} onMove={(to) => move(ins.id, ins.status, to)} />
            ))}
          </BoardColumn>
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <CardBody ins={activeCard} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  count,
  children,
}: {
  status: InspectionStatus;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 snap-start flex-col rounded-lg border bg-muted/50 transition-colors",
        isOver ? "border-urgency-brand bg-muted" : "border-border",
      )}
    >
      <header className="flex items-baseline justify-between border-b border-border px-3 py-2">
        <h3 className="text-meta font-medium uppercase tracking-wider text-foreground">
          {statusLabel(status)}
        </h3>
        <span className="font-mono text-meta tabular-nums text-muted-foreground">{count}</span>
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

function BoardCard({
  ins,
  onMove,
}: {
  ins: BoardInspection;
  onMove: (to: InspectionStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ins.id,
    data: { from: ins.status },
  });
  const handle = (
    <button
      type="button"
      aria-label="Drag to move"
      className="-ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <CardBody ins={ins} onMove={onMove} handle={handle} />
    </div>
  );
}

/** The visual card — shared by the live card and the drag overlay. */
function CardBody({
  ins,
  onMove,
  handle,
  dragging = false,
}: {
  ins: BoardInspection;
  onMove?: (to: InspectionStatus) => void;
  handle?: React.ReactNode;
  dragging?: boolean;
}) {
  const next = allowedNext(ins.status);
  const where = [ins.propertyName, ins.unitLabel].filter(Boolean).join(" · ");
  return (
    <article
      className={cn(
        "rounded-md border border-border bg-card p-2 text-body shadow-sm",
        dragging && "shadow-lg",
      )}
    >
      <div className="flex items-center gap-1.5">
        {handle}
        <span className="text-label font-medium text-foreground">{kindLabel(ins.kind)}</span>
        <span className="ml-auto font-mono text-meta tabular-nums text-muted-foreground">
          INS-{ins.id.slice(0, 6).toUpperCase()}
        </span>
      </div>
      <Link
        href={`/inspections/${ins.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 block text-label text-muted-foreground hover:text-foreground hover:underline"
      >
        {where || "No location"}
      </Link>
      <div className="mt-0.5 text-meta text-muted-foreground">
        {ins.scheduledFor
          ? `Scheduled ${new Date(ins.scheduledFor).toLocaleDateString()}`
          : `Created ${new Date(ins.createdAt).toLocaleDateString()}`}
      </div>
      {onMove && next.length > 0 && (
        <details className="mt-2">
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
                onClick={() => onMove(to)}
              >
                <ChevronRight />
                {statusLabel(to)}
              </Button>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
