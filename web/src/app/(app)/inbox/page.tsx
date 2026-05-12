import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Inbox as InboxIcon } from "lucide-react";
import { loadInbox } from "@/lib/server/inbox";
import { TimeSince, TimeSinceTicker } from "@/components/operator/time-since";
import { UrgencyDot } from "@/components/operator/urgency-dot";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const items = await loadInbox(50);
  const unread = items.filter((i) => i.unread).length;

  return (
    <TimeSinceTicker>
      <div className="mx-auto max-w-[720px] px-3 py-3 md:px-4">
        <header className="mb-3 flex items-center gap-2">
          <InboxIcon className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Inbox</h1>
          {unread > 0 && (
            <span className="font-mono text-xs tabular-nums text-urgency-overdue">
              {unread} new
            </span>
          )}
          <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground">
            {items.length} total
          </span>
        </header>

        {items.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            No notifications yet. Mentions, assignments, and approvals will land
            here.
          </p>
        ) : (
          <ul className="space-y-0">
            {items.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-2 text-sm",
                  n.unread ? "bg-card" : "opacity-70",
                )}
              >
                <UrgencyDot
                  urgency={n.unread ? "inflow" : "muted"}
                  className="mt-1.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{n.subject}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {n.kind.replace(/_/g, " ")}
                    </span>
                    <TimeSince at={n.at} className="ml-auto" />
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

      </div>
    </TimeSinceTicker>
  );
}
