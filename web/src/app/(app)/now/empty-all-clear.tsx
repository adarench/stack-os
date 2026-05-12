import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * When every lane is empty. A quiet line, not a celebration. Two suggested
 * next actions tee up the operator's review cadence.
 */
export function EmptyAllClear() {
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center text-center">
      <Sparkles className="mb-2 size-6 text-urgency-done" />
      <p className="text-sm font-medium">Inbox zero. The yard is clean.</p>
      <p className="mb-4 text-xs text-muted-foreground">
        Nothing on fire, nothing waiting, nothing overdue.
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
