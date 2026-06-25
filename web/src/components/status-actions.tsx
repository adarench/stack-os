"use client";

import { useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { allowedNext, type WorkOrderStatus } from "@contracts/state-machines/work-order";
import { transitionStatusAction } from "@/lib/actions/work-orders";
import { Button } from "@/components/ui/button";

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
    return <p className="text-meta text-muted-foreground">Terminal state.</p>;
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
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            <ChevronRight className="size-3.5" />
            {to.replace(/_/g, " ")}
          </Button>
        </form>
      ))}
    </div>
  );
}
