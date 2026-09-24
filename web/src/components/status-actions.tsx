"use client";

import { useTransition } from "react";
import { techActions } from "@contracts/state-machines/work-order-tech-ux";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";
import { applyTechActionAction } from "@/app/(app)/work-orders/_actions";

/**
 * Tech-facing status controls for WO detail (ops #20).
 * Only Complete / Waiting — no Start Work / Blocked / raw FSM dump.
 * Board/dispatcher keep full allowedNext menus.
 */
export function StatusActions({
  workOrderId,
  status,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
}) {
  const actions = techActions(status);
  const [pending, start] = useTransition();

  if (actions.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No tech actions available from this status — office triage may be required.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <form
          key={a.kind}
          action={(fd) => start(() => applyTechActionAction(fd))}
        >
          <input type="hidden" name="id" value={workOrderId} />
          <input type="hidden" name="kind" value={a.kind} />
          <button
            type="submit"
            disabled={pending}
            className={
              a.kind === "complete"
                ? "rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
                : "rounded-full border border-amber-500 bg-white px-4 py-2 text-sm font-medium text-amber-800 active:bg-amber-50 disabled:opacity-50"
            }
          >
            {a.label}
          </button>
        </form>
      ))}
    </div>
  );
}
