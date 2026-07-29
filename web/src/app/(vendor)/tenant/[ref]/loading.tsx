/** Instant skeleton for a tenant request detail (the heaviest tenant read:
 *  work order + messages + timeline + signed photo URLs). */
export default function TenantDetailLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-5 w-24 rounded bg-muted/70" />
      <div className="space-y-2">
        <div className="h-6 w-4/5 rounded bg-muted" />
        <div className="h-3 w-32 rounded-full bg-muted/70" />
      </div>
      <div className="h-40 w-full rounded-lg bg-muted/60" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted/70" />
        <div className="h-3 w-11/12 rounded bg-muted/70" />
        <div className="h-3 w-2/3 rounded bg-muted/70" />
      </div>
    </div>
  );
}
