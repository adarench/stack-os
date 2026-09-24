"use client";

import { useRef, useTransition } from "react";
import { addCommentAction } from "@/app/(app)/work-orders/_actions";

/**
 * Standard text-input send control for WO messaging (ops #21).
 * Disabled while in-flight to reduce duplicate sends.
 */
export function CommentForm({ targetId }: { targetId: string }) {
  const ref = useRef<HTMLFormElement | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={ref}
      action={(fd) => {
        if (pending) return;
        const body = String(fd.get("body") ?? "").trim();
        if (!body) return;
        start(async () => {
          await addCommentAction(fd);
          ref.current?.reset();
        });
      }}
      className="mt-2 space-y-2"
    >
      <input type="hidden" name="targetId" value={targetId} />
      <textarea
        name="body"
        rows={2}
        required
        disabled={pending}
        placeholder="Write a message…"
        autoComplete="off"
        className="w-full resize-y rounded border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
