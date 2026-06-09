import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComplianceBlocker } from "@/lib/server/compliance-view";

/**
 * The "Blocked by compliance" lane on /now. Vendors who can't be dispatched
 * (no/expired COI) or are about to lapse, worst-first, with the open work
 * they put at risk. Server-rendered: blocked WO refs are plain ?d= links that
 * open the drawer, so the operator can jump to a blocked WO and reassign it
 * to a compliant vendor — the whole point of surfacing this on the cockpit.
 */
export function ComplianceLane({ blockers }: { blockers: ComplianceBlocker[] }) {
  if (blockers.length === 0) return null;
  return (
    <section className="mb-2 border-t-2 border-urgency-overdue/40 pt-2">
      <div className="flex items-baseline gap-2 px-2 pb-1">
        <h2 className="text-[13px] font-semibold text-urgency-overdue">
          Blocked by compliance
        </h2>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {blockers.length}
        </span>
        <Link
          href="/compliance"
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
        >
          all compliance →
        </Link>
      </div>
      <div className="space-y-0">
        {blockers.map((b) => (
          <div
            key={b.key}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted/40"
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                b.tone === "alert" ? "bg-urgency-overdue" : "bg-urgency-blocked",
              )}
            />
            <span className="shrink-0 font-medium text-foreground">
              {b.vendorName}
            </span>
            <span
              className={cn(
                "shrink-0 text-[10px] uppercase tracking-wider",
                b.tone === "alert"
                  ? "text-urgency-overdue"
                  : "text-urgency-blocked",
              )}
            >
              {b.reason}
            </span>
            {b.detail && (
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {b.detail}
              </span>
            )}
            <span className="ml-auto flex items-center gap-2 overflow-hidden">
              {b.blockedWoRefs.length > 0 ? (
                <span className="flex items-center gap-1.5 truncate">
                  {b.blockedWoRefs.slice(0, 3).map((w) => (
                    <Link
                      key={w.ref}
                      href={`?d=${w.ref}`}
                      scroll={false}
                      data-ref={w.ref}
                      className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/80 hover:text-foreground hover:underline"
                    >
                      {w.ref}
                    </Link>
                  ))}
                </span>
              ) : null}
              {b.blockedCount > 0 && (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-urgency-overdue">
                  blocks {b.blockedCount}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
