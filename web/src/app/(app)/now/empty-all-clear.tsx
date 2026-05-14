import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Empty /now state. Dispatch tone — the board is quiet but the watch
 * continues. No sparkles, no congratulations; just the operational
 * status the dispatcher actually reads.
 */
export function EmptyAllClear() {
  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col items-center text-center">
      <span className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="size-1.5 rounded-full bg-urgency-done" aria-hidden />
        Watching
      </span>
      <p className="text-sm font-medium">All lanes clear.</p>
      <p className="mb-5 text-xs text-muted-foreground">
        Nothing overdue, blocked, or in flight. The board refreshes on its own.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="soft" size="sm">
          <Link href="/work">Browse work</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/work?recent=7d">Weekly review</Link>
        </Button>
      </div>
    </div>
  );
}
