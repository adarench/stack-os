import Link from "next/link";

/**
 * Structured filters for /work — building, tech, status, created-date range.
 * A plain GET form (no client JS): submitting reloads /work with the params.
 * Preserves any other active params (lens, view, search) as hidden inputs so
 * filters compose with the lens tabs.
 */
export function WorkFilters({
  sp,
  properties,
  staff,
}: {
  sp: Record<string, string | string[] | undefined>;
  properties: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; name: string | null; email: string }>;
}) {
  const cur = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const controlled = new Set(["propertyId", "assigneeId", "status", "from", "to"]);
  const preserved = Object.entries(sp).filter(([k]) => !controlled.has(k));
  const hasFilters = ["propertyId", "assigneeId", "from", "to"].some((k) => cur(k));

  return (
    <details className="border-b border-border" open={hasFilters}>
      <summary className="cursor-pointer select-none px-2 py-2 text-[12px] text-muted-foreground hover:text-foreground">
        Filters{hasFilters ? " · on" : ""}
      </summary>
      <form
        method="get"
        action="/work"
        className="flex flex-wrap items-end gap-3 px-2 pb-3 text-[13px]"
      >
        {preserved.map(([k, v]) => (
          <input
            key={k}
            type="hidden"
            name={k}
            value={Array.isArray(v) ? (v[0] ?? "") : String(v)}
          />
        ))}
        <Field label="Building">
          <select name="propertyId" defaultValue={cur("propertyId")} className={SELECT}>
            <option value="">All buildings</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tech">
          <select name="assigneeId" defaultValue={cur("assigneeId")} className={SELECT}>
            <option value="">Anyone</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={cur("status") || "open"} className={SELECT}>
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="blocked">Waiting</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </Field>
        <Field label="From">
          <input type="date" name="from" defaultValue={cur("from")} className={SELECT} />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={cur("to")} className={SELECT} />
        </Field>
        <button
          type="submit"
          className="h-8 rounded-md bg-foreground px-3 text-[13px] font-medium text-background"
        >
          Apply
        </button>
        {hasFilters && (
          <Link href="/work" className="h-8 px-2 text-[13px] leading-8 text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        )}
      </form>
    </details>
  );
}

const SELECT =
  "h-8 rounded-md border border-border bg-background px-2 text-[13px]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
