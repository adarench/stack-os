"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideApprovalActionResult } from "./_actions";

/**
 * Approve / Reject pair for a single approval row. On click, calls the
 * server action via a transition, shows a toast based on result. Optimistic
 * UI: the button shows a pending state during the action.
 */
export function ApprovalButtons({
  approvalId,
  amountCents,
}: {
  approvalId: string;
  amountCents: number;
}) {
  const [pending, startTransition] = React.useTransition();

  const decide = (to: "approved" | "rejected") => {
    startTransition(async () => {
      const result = await decideApprovalActionResult(approvalId, to);
      const dollars = `$${(amountCents / 100).toFixed(2)}`;
      if (result.ok) {
        toast.success(
          to === "approved" ? `Approved · ${dollars}` : `Rejected · ${dollars}`,
        );
      } else {
        toast.error(
          to === "approved"
            ? `Couldn't approve: ${result.error}`
            : `Couldn't reject: ${result.error}`,
        );
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => decide("approved")}
        className="bg-urgency-done text-white hover:bg-urgency-done/90"
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => decide("rejected")}
      >
        Reject
      </Button>
    </>
  );
}
