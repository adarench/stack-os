import type { TenantTimelineEvent } from "@/lib/server/tenant-requests";
import { cn } from "@/lib/utils";

/** Vertical status timeline — a dot + connector per milestone, newest last. */
export function Timeline({ events }: { events: TenantTimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="space-y-0">
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            <div className="relative flex w-3 shrink-0 justify-center">
              <span
                className={cn(
                  "z-10 mt-1 size-2.5 rounded-full",
                  isLast ? "bg-foreground" : "bg-muted-foreground/40",
                )}
              />
              {!isLast && (
                <span className="absolute top-2 h-full w-px bg-border" aria-hidden />
              )}
            </div>
            <div className="-mt-0.5 min-w-0 flex-1">
              <p className={cn("text-body", isLast ? "font-medium text-foreground" : "text-foreground/80")}>
                {e.label}
              </p>
              <p className="text-meta text-muted-foreground">
                {new Date(e.at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
