import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The standard empty state — generalized from the /now "all lanes clear"
 * pattern. Quiet, sentence-case, instructive; an optional dispatch-tone
 * eyebrow with a status dot, and an actions slot for the next move. Replaces
 * the ~8 ad-hoc `mt-12 text-center` one-liners. Deliberately no illustration —
 * that would clash with the instrument-panel restraint.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto mt-16 flex max-w-sm flex-col items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <span className="mb-3 inline-flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-urgency-muted" aria-hidden />
          {eyebrow}
        </span>
      )}
      <p className="text-body font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-label text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-5 flex items-center gap-2">{children}</div>}
    </div>
  );
}
