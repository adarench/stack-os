import Link from "next/link";
import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardCheck, RefreshCw, Wrench } from "lucide-react";
import { loadCalendar, type CalendarKind } from "@/lib/server/calendar";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Calendar v0 — the agenda view. Proves recurring walks/inspections fire on
 * schedule (the thing Trello did that AppFolio can't), alongside scheduled
 * inspections and due work orders. Read-only; editing schedules lives in
 * /admin/templates.
 */
export default async function CalendarPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const days = await loadCalendar();

  return (
    <div className="mx-auto max-w-[840px] px-3 py-4 md:px-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Calendar
        </h1>
        <Link
          href="/admin/templates"
          className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"
        >
          Manage recurring
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {days.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm text-center">
          <p className="text-sm font-medium">Nothing scheduled in the next 30 days.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add recurring walks and inspections in{" "}
            <Link
              href="/admin/templates"
              className="underline hover:text-foreground"
            >
              recurring templates
            </Link>{" "}
            and they&rsquo;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-0 pb-16">
          {days.map((d) => (
            <section
              key={d.day}
              className="border-t border-border first:border-t-0"
            >
              <header className="flex items-baseline gap-2 px-2 pb-1 pt-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDay(d.day)}
                </h2>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {d.items.length}
                </span>
              </header>
              <ul className="space-y-0">
                {d.items.map((item, i) => (
                  <li key={`${item.kind}-${item.href}-${i}`}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 px-2 py-2 hover:bg-accent"
                    >
                      <KindIcon kind={item.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      <time className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatTime(item.at)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: CalendarKind }) {
  const cls = "size-4 shrink-0";
  if (kind === "recurring")
    return <RefreshCw className={cn(cls, "text-urgency-brand")} aria-label="Recurring" />;
  if (kind === "inspection")
    return <ClipboardCheck className={cn(cls, "text-muted-foreground")} aria-label="Inspection" />;
  return <Wrench className={cn(cls, "text-muted-foreground")} aria-label="Work order" />;
}

function formatDay(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(/\s/g, "");
}
