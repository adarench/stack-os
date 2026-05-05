"use client";

import { useTransition } from "react";
import { allowedNext, type WorkOrderStatus } from "@contracts/state-machines/work-order";
import { transitionStatusAction } from "@/app/(app)/work-orders/_actions";

export function StatusActions({
  workOrderId,
  status,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
}) {
  const next = allowedNext(status);
  const [pending, start] = useTransition();
  if (next.length === 0) {
    return <p className="text-xs text-neutral-500">Terminal state.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((to) => (
        <form
          key={to}
          action={(fd) => start(() => transitionStatusAction(fd))}
        >
          <input type="hidden" name="id" value={workOrderId} />
          <input type="hidden" name="to" value={to} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-700 active:bg-neutral-100 disabled:opacity-50"
          >
            → {to.replace(/_/g, " ")}
          </button>
        </form>
      ))}
    </div>
  );
}
