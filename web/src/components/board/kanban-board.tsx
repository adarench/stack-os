"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  WORK_ORDER_STATUSES,
  allowedNext,
  canTransition,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";
import {
  batchSetStatusAction,
  moveWorkOrderAction,
} from "@/lib/actions/work-orders";
import type { BoardWorkOrder } from "@/lib/server/board";
import { workOrderTransitionLabel } from "@/lib/labels";
import { Column } from "./column";
import { Card } from "./card";

interface Props {
  initial: Record<WorkOrderStatus, BoardWorkOrder[]>;
  columns: WorkOrderStatus[];
}

/**
 * Keyboard-driven kanban. Drag-drop is gone per
 * docs/design/p9_cockpit_strategy.md (PM-tool gimmick rejected); the column
 * shape survives because the dispatcher's visual mental model is columns +
 * states. Selection model:
 *
 *   click          select a single card
 *   shift-click    toggle a card in/out of the selection
 *   esc            clear the selection
 *   s              open the batch status menu (when selection non-empty)
 *
 * The bottom action bar appears when any card is selected and offers the
 * status transitions reachable from *every* selected card (intersection).
 */
export function KanbanBoard({ initial, columns }: Props) {
  const [byStatus, setByStatus] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSelect = (id: string, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        // Plain click — toggle as a single-card selection.
        if (next.has(id) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(id);
        }
      }
      return next;
    });
  };

  // Lookup index: cardId → current status. Used to compute the batch's
  // common allowed-next intersection.
  const statusById = useMemo(() => {
    const m = new Map<string, WorkOrderStatus>();
    for (const s of WORK_ORDER_STATUSES) {
      for (const c of byStatus[s] ?? []) m.set(c.id, s);
    }
    return m;
  }, [byStatus]);

  const intersectionTargets = useMemo<WorkOrderStatus[]>(() => {
    if (selected.size === 0) return [];
    let candidates: Set<WorkOrderStatus> | null = null;
    for (const id of selected) {
      const from = statusById.get(id);
      if (!from) continue;
      const allowed = new Set(allowedNext(from));
      if (candidates === null) candidates = allowed;
      else {
        for (const t of Array.from(candidates)) {
          if (!allowed.has(t)) candidates.delete(t);
        }
      }
    }
    return candidates ? Array.from(candidates) : [];
  }, [selected, statusById]);

  // Keyboard: esc clears, s opens batch menu when selection non-empty.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable === true;
      if (inField) return;
      if (e.key === "Escape") {
        setSelected(new Set());
        setShowMenu(false);
      } else if (e.key.toLowerCase() === "s" && selected.size > 0 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowMenu((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Optimistic batch transition.
  const batchMove = (to: WorkOrderStatus) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const prevSnapshot = byStatus;
    setByStatus((prev) => {
      const next: Record<WorkOrderStatus, BoardWorkOrder[]> = { ...prev };
      const moving: BoardWorkOrder[] = [];
      for (const s of WORK_ORDER_STATUSES) {
        const remain: BoardWorkOrder[] = [];
        for (const c of prev[s] ?? []) {
          if (ids.includes(c.id) && canTransition(s, to)) {
            moving.push({ ...c, status: to });
          } else {
            remain.push(c);
          }
        }
        next[s] = remain;
      }
      next[to] = [...moving, ...(next[to] ?? [])];
      return next;
    });
    setShowMenu(false);
    setSelected(new Set());
    startTransition(async () => {
      const r = await batchSetStatusAction(ids, to);
      if (r.ok) {
        toast.success(
          `${r.moved} card${r.moved === 1 ? "" : "s"} → ${workOrderTransitionLabel(to)}`,
        );
      } else {
        setByStatus(prevSnapshot);
        toast.error(`Batch stopped after ${r.moved}: ${r.error}`);
      }
    });
  };

  // Single-card Move… menu — kept for the dispatcher who wants to flip one
  // card without staging it for batch. Same server action; same audit row.
  const moveOne = (id: string, from: WorkOrderStatus, to: WorkOrderStatus) => {
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
        toast.error(`Couldn't move: ${result.error}`);
      }
    });
  };

  return (
    <div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-20">
        {columns.map((status) => {
          const cards = byStatus[status] ?? [];
          const sCount = cards.filter((c) => selected.has(c.id)).length;
          return (
            <Column
              key={status}
              status={status}
              count={cards.length}
              selectedCount={sCount}
            >
              {cards.map((w) => (
                <Card
                  key={w.id}
                  wo={w}
                  selected={selected.has(w.id)}
                  onSelect={onSelect}
                  onMove={(to) => moveOne(w.id, status, to)}
                />
              ))}
            </Column>
          );
        })}
      </div>

      {selected.size > 0 && (
        <BatchActionBar
          count={selected.size}
          targets={intersectionTargets}
          pending={pending}
          menuOpen={showMenu}
          onToggleMenu={() => setShowMenu((v) => !v)}
          onMove={batchMove}
          onClear={() => {
            setSelected(new Set());
            setShowMenu(false);
          }}
        />
      )}
    </div>
  );
}

function BatchActionBar({
  count,
  targets,
  pending,
  menuOpen,
  onToggleMenu,
  onMove,
  onClear,
}: {
  count: number;
  targets: WorkOrderStatus[];
  pending: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onMove: (to: WorkOrderStatus) => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3 shadow-lg">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {count} selected
        </span>
        <div className="relative ml-auto">
          <button
            type="button"
            disabled={pending || targets.length === 0}
            onClick={onToggleMenu}
            className="rounded border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
          >
            Status → {targets.length === 0 ? "(no common target)" : `(s)`}
          </button>
          {menuOpen && targets.length > 0 && (
            <div className="absolute bottom-full right-0 mb-1 min-w-[180px] rounded border border-border bg-background shadow-md">
              {targets.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onMove(t)}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                >
                  → {workOrderTransitionLabel(t)}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear (esc)
        </button>
      </div>
    </div>
  );
}
