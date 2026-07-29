/** Instant skeleton for the tenant home list (shown inside TenantShell while the
 *  server loads requests — no frozen previous screen on tab/nav taps). */
export default function TenantHomeLoading() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="h-9 w-40 rounded-md bg-muted" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-3.5">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="mt-2 h-3 w-1/2 rounded bg-muted/70" />
          <div className="mt-3 h-3 w-24 rounded-full bg-muted/70" />
        </div>
      ))}
    </div>
  );
}
