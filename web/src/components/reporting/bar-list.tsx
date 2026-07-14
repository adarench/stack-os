import { cn } from "@/lib/utils";

/**
 * Token-styled horizontal bar list — the reporting v1 "chart". No chart lib:
 * a labelled row, a proportional bar, and a value, all in semantic tokens so
 * `lint:tokens` stays clean. `tone` is a bar background token class.
 */
export function BarList({
  items,
  tone = "bg-foreground",
}: {
  items: { label: string; value: number }[];
  tone?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="text-label text-muted-foreground">No data.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-label">
          <span className="w-28 shrink-0 truncate text-muted-foreground" title={i.label}>
            {i.label}
          </span>
          <span className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 rounded", tone)}
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right tabular-nums text-foreground">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
