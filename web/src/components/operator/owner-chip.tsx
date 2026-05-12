import { cn } from "@/lib/utils";

/**
 * 20px owner avatar. Shows up to 2 initials on a muted background; renders
 * a dashed circle when unassigned. Tooltip showing full name is handled by
 * the parent EntityRow (single tooltip per row).
 */
export function OwnerChip({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) {
    return (
      <span
        aria-label="Unassigned"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-[10px] text-muted-foreground",
          className,
        )}
      >
        —
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      aria-label={name}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase text-foreground",
        className,
      )}
      title={name}
    >
      {initials || "?"}
    </span>
  );
}
