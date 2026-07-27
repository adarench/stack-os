function statusClasses(status: string): string {
  switch (status) {
    case "in_progress":
      return "bg-urgency-today/15 text-urgency-today";
    case "blocked":
      return "bg-urgency-blocked/15 text-urgency-blocked";
    case "resolved":
    case "verified":
    case "closed":
      return "bg-urgency-done/15 text-urgency-done";
    default:
      return "bg-urgency-inflow/15 text-urgency-inflow";
  }
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusClasses(
        status,
      )}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function location(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}
