import Link from "next/link";
import { loadPropertiesIndex } from "@/lib/server/reporting";

export const dynamic = "force-dynamic";

/**
 * Properties index — the entry to the per-unit work history ("what did we do
 * for tenant X"). Drill into a building → unit → its full work-order log.
 */
export default async function PropertiesPage() {
  const props = await loadPropertiesIndex();
  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <h1 className="mb-1 text-lg font-semibold">Properties</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Open a building to see each unit&rsquo;s tenant and full work history.
      </p>
      {props.length === 0 ? (
        <p className="text-sm text-muted-foreground">No properties yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {props.map((p) => (
            <li key={p.id}>
              <Link
                href={`/properties/${p.id}`}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted"
              >
                <span className="font-medium">{p.name}</span>
                {p.location && (
                  <span className="text-xs text-muted-foreground">{p.location}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {p.techName ?? "no tech"}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {p.openCount} open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
