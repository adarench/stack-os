import type { WorkOrderStatus } from "@contracts/state-machines/work-order";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { workOrderStatusLabel } from "@/lib/labels";

/**
 * Shared work-order status chip. Routes through the one Badge recipe + the
 * central status→tone mapper, so it speaks the same rationed urgency language
 * as the operator shell instead of a hand-rolled 10-color rainbow.
 */
export function StatusPill({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={toneForStatus(status)}>{workOrderStatusLabel(status)}</Badge>;
}
