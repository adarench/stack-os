"use client";

import { useRef, useTransition } from "react";
import { addCommentAction } from "@/app/(app)/work-orders/_actions";

export function CommentForm({ targetId }: { targetId: string }) {
  const ref = useRef<HTMLFormElement | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      action={(fd) =>
        start(async () => {
          await addCommentAction(fd);
          ref.current?.reset();
        })
      }
      className="mt-2 flex gap-2"
    >
      <input type="hidden" name="targetId" value={targetId} />
      <input
        name="body"
        placeholder="Add a comment…"
        autoComplete="off"
        className="flex-1 rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Post
      </button>
    </form>
  );
}
