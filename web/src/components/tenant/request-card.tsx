import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TenantRequest } from "@/lib/server/tenant-requests";

/** Tenant-facing status → badge tone. "Waiting on you" is red (their move). */
function toneFor(status: string, blockedReason?: string | null): BadgeTone {
  switch (status) {
    case "new":
    case "triaged":
      return "muted";
    case "assigned":
    case "scheduled":
    case "in_progress":
      return "inflow";
    case "blocked":
      return blockedReason === "waiting_tenant" ? "overdue" : "blocked";
    case "resolved":
    case "verified":
      return "done";
    default:
      return "muted"; // closed, cancelled
  }
}

export function RequestCard({ request }: { request: TenantRequest }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3.5",
        request.needsAction
          ? "border-urgency-done/40 ring-1 ring-urgency-done/20"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-body font-medium text-foreground">{request.title}</p>
        <Badge tone={toneFor(request.status)} className="shrink-0">
          {request.tenantStatus}
        </Badge>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-label text-muted-foreground">
        <span className="font-mono tabular-nums">{request.ref}</span>
        <span aria-hidden>·</span>
        <span>Updated {new Date(request.updatedAt).toLocaleDateString()}</span>
      </div>
      {request.needsAction && (
        <p className="mt-2 text-label font-medium text-urgency-done">
          Please confirm the work is done.
        </p>
      )}
    </div>
  );
}
