import Link from "next/link";
import { loadTechnicianQueue } from "@/lib/server/technician";
import { StatusChip, location } from "./_ui";

export const dynamic = "force-dynamic";

export default async function TechQueuePage() {
  const items = await loadTechnicianQueue();
  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">My work</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {items.length} assigned
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nothing assigned right now.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((w) => (
            <li key={w.id}>
              <Link
                href={`/tech/${w.ref}`}
                className="block rounded-lg border border-border bg-background p-3 shadow-sm transition-colors active:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">{w.ref}</span>
                  <StatusChip status={w.status} />
                </div>
                <p className="mt-1 text-sm font-medium">{w.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {location([
                    w.property,
                    w.floor ? `Floor ${w.floor}` : null,
                    w.suite ? `Suite ${w.suite}` : w.unit,
                  ])}
                </p>
                {w.requester && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Requested by {w.requester}
                  </p>
                )}
                {!w.acknowledged && (
                  <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-urgency-inflow">
                    New · not seen
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
