import Link from "next/link";
import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { Inbox as InboxIcon } from "lucide-react";
import { loadInbox } from "@/lib/server/inbox";
import { TimeSince, TimeSinceTicker } from "@/components/operator/time-since";
import { UrgencyDot } from "@/components/operator/urgency-dot";
import { notificationKindLabel, notificationKindPriority } from "@/lib/labels";
import { Page } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";
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
      <Page width="default">
        <header className="mb-3 flex items-center gap-2">
          <InboxIcon className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
          {unread > 0 && (
            <span className="font-mono text-meta tabular-nums text-urgency-overdue">
              {unread} new
            </span>
          )}
          <span className="ml-auto font-mono text-meta tabular-nums text-muted-foreground">
            {items.length} total
          </span>
        </header>

        {items.length === 0 ? (
          <EmptyState
            eyebrow="Inbox"
            title="Quiet."
            description="Mentions, assignments, and approvals land here as they happen."
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {threaded.map(({ n, threadChild }) => {
              const prio = notificationKindPriority(n.kind);
              const isHigh = prio === "high";
              const isQuiet = prio === "quiet";
              return (
                <li
                  key={n.id}
                  className={cn(
                    // Hairline-separated (ul divides); unread rows stay full
                    // strength while read rows recede — the dot carries the
                    // colour cue. (Old bg-card was invisible on bg-background.)
                    "flex items-start gap-2 px-2 py-2.5 text-sm transition-colors hover:bg-muted/40",
                    threadChild && "pl-6",
                    !n.unread && "opacity-55",
                    isQuiet && n.unread && "opacity-80",
                  )}
                >
                  <UrgencyDot
                    urgency={
                      isHigh && n.unread
                        ? "overdue"
                        : n.unread
                          ? "inflow"
                          : "muted"
                    }
                    className="mt-1.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      {!threadChild && (
                        <span
                          className={cn(
                            isHigh ? "font-semibold" : "font-medium",
                          )}
                        >
                          {n.subject}
                        </span>
                      )}
                      {threadChild && (
                        <span className="text-muted-foreground">{n.subject}</span>
                      )}
                      {n.targetRef && (
                        <Link
                          href={`?d=${n.targetRef}`}
                          scroll={false}
                          data-ref={n.targetRef}
                          className="font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                        >
                          {n.targetRef}
                        </Link>
                      )}
                      {!threadChild && (
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-wider",
                            isHigh
                              ? "text-urgency-overdue"
                              : "text-muted-foreground",
                          )}
                        >
                          {notificationKindLabel(n.kind)}
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
              );
            })}
          </ul>
        )}
      </Page>
    </TimeSinceTicker>
  );
}
