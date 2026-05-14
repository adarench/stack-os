import Link from "next/link";
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

  // Soft threading — when consecutive rows share a targetRef, the
  // followers indent under the first. No collapse, no nesting; the
  // dispatcher still sees every update, just stacked visually.
  const threaded = items.map((n, i) => ({
    n,
    threadChild: i > 0 && n.targetRef !== null && items[i - 1]?.targetRef === n.targetRef,
  }));

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
            Quiet. Mentions, assignments, and approvals land here as they happen.
          </p>
        ) : (
          <ul className="space-y-0">
            {threaded.map(({ n, threadChild }) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-2 text-sm",
                  n.unread ? "bg-card" : "opacity-70",
                  threadChild && "pl-6 -mt-1",
                )}
              >
                <UrgencyDot
                  urgency={n.unread ? "inflow" : "muted"}
                  className="mt-1.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    {!threadChild && (
                      <span className="font-medium">{n.subject}</span>
                    )}
                    {threadChild && (
                      <span className="text-muted-foreground">{n.subject}</span>
                    )}
                    {n.targetRef && (
                      <Link
                        href={`?d=${n.targetRef}`}
                        scroll={false}
                        className="font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                      >
                        {n.targetRef}
                      </Link>
                    )}
                    {!threadChild && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {n.kind.replace(/_/g, " ")}
                      </span>
                    )}
                    <TimeSince at={n.at} className="ml-auto" />
                  </div>
                  {n.body && !threadChild && (
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
