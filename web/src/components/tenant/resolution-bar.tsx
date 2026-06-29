"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  confirmResolvedAction,
  reopenRequestAction,
} from "@/app/(vendor)/tenant/_actions";

/** Shown when a request is `resolved` — the resident confirms or reopens. */
export function ResolutionBar({
  refId,
  workOrderId,
}: {
  refId: string;
  workOrderId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"ask" | "reopen">("ask");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const r = await confirmResolvedAction(refId, workOrderId);
      if (r.ok) router.refresh();
    });
  }
  function reopen() {
    if (!note.trim()) return;
    start(async () => {
      const r = await reopenRequestAction(refId, workOrderId, note);
      if (r.ok) {
        setNote("");
        setMode("ask");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-urgency-done/40 bg-urgency-done/10 p-3.5">
      <p className="text-body font-medium text-foreground">The team marked this complete.</p>
      <p className="mt-0.5 text-label text-muted-foreground">Is the issue actually fixed?</p>

      {mode === "ask" ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={confirm} disabled={pending} className="h-10 flex-1">
            <Check className="size-4" />
            Yes, it&apos;s fixed
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode("reopen")}
            disabled={pending}
            className="h-10 flex-1"
          >
            No, still broken
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What's still wrong?"
            className="bg-background"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={reopen}
              disabled={pending || !note.trim()}
              className="h-10 flex-1"
            >
              {pending ? "Reopening…" : "Reopen request"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("ask")}
              disabled={pending}
              className="h-10"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
