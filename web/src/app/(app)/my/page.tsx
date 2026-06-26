import Link from "next/link";
import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { loadWorkList, type WorkRow } from "@/lib/server/work-list";
import { WorkOrderRow } from "@/components/operator/work-order-row";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { LiveIndicator } from "@/components/operator/live-indicator";
import { PushSubscribe } from "@/components/operator/push-subscribe";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * My Work — the technician's home surface. The smallest, most concrete thing
 * a field tech needs: *their* open work, pressure-first, one tap from action.
 *
 * Reuses the unified work-list reader with the `mine` filter (assignments →
 * current user). No new data layer. The push-subscribe prompt rides here so
 * techs are asked to enable notifications on the screen they live in.
 */
export default async function MyWorkPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const { rows } = await loadWorkList({
    type: "wo",
    status: "open",
    mine: "mine",
  });

  const bands = partition(rows);

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={20_000} />
      <div className="mx-auto max-w-[840px] px-3 py-4 md:px-4">
        <header className="mb-2 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            My Work
          </h1>
          <LiveIndicator />
        </header>

        <PushSubscribe />

        {rows.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm text-center">
            <p className="text-sm font-medium">You&rsquo;re all caught up.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing assigned to you is open right now. New work lands here the
              moment it&rsquo;s assigned — you&rsquo;ll get a push too.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Looking for the full queue?{" "}
              <Link href="/work" className="underline hover:text-foreground">
                Go to Work →
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-0 pb-16">
            {BAND_ORDER.map((band) => {
              const items = bands[band];
              if (items.length === 0) return null;
              return <BandSection key={band} band={band} items={items} />;
            })}
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}

/* -------------------- band partitioning -------------------- */

type Band = "aging" | "waiting" | "open";

const BAND_ORDER: Band[] = ["aging", "waiting", "open"];

const BAND_LABEL: Record<Band, string> = {
  aging: "Aging >7d",
  waiting: "Waiting",
  open: "Open",
};

function partition(rows: WorkRow[]): Record<Band, WorkRow[]> {
  const out: Record<Band, WorkRow[]> = { aging: [], waiting: [], open: [] };
  for (const r of rows) out[bandFor(r)].push(r);
  return out;
}

function bandFor(r: WorkRow): Band {
  // Aging (open >7d) escalates above everything; then waiting; else open.
  if (r.aged) return "aging";
  if (r.urgency === "blocked") return "waiting";
  return "open";
}

function BandSection({ band, items }: { band: Band; items: WorkRow[] }) {
  const tone =
    band === "aging"
      ? "text-urgency-overdue"
      : band === "waiting"
        ? "text-urgency-blocked"
        : "text-muted-foreground";
  return (
    <section
      aria-label={BAND_LABEL[band]}
      className={cn(
        "border-t border-border first:border-t-0",
        band === "aging" && "border-urgency-overdue/30",
        band === "waiting" && "border-urgency-blocked/30",
      )}
    >
      <header className="flex items-baseline gap-2 px-2 pb-1 pt-3">
        <h2
          className={cn(
            "text-[11px] uppercase tracking-wider",
            band !== "open" ? "font-bold" : "font-semibold",
            tone,
          )}
        >
          {BAND_LABEL[band]}
        </h2>
        <span className={cn("font-mono text-[11px] tabular-nums", tone)}>
          {items.length}
        </span>
      </header>
      {/* Operator-console row, same as /work. */}
      <div>
        {items.map((row) => (
          <WorkOrderRow key={row.ref} row={row} />
        ))}
      </div>
    </section>
  );
}
