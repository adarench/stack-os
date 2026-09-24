import type { WorkOrderStatus } from "@contracts/state-machines/work-order";
import { techStatusLabel } from "@contracts/state-machines/work-order-tech-ux";

const STYLES: Record<WorkOrderStatus, string> = {
  new: "bg-neutral-100 text-neutral-700",
  triaged: "bg-sky-100 text-sky-800",
  assigned: "bg-blue-100 text-blue-800",
  scheduled: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  blocked: "bg-amber-100 text-amber-900",
  resolved: "bg-emerald-100 text-emerald-800",
  verified: "bg-emerald-200 text-emerald-900",
  closed: "bg-neutral-200 text-neutral-700",
  cancelled: "bg-neutral-200 text-neutral-500 line-through",
};

export function StatusPill({ status }: { status: WorkOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      {techStatusLabel(status)}
    </span>
  );
}
