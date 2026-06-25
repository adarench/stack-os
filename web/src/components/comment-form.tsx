"use client";

import { useRef, useTransition } from "react";
import { addCommentAction } from "@/lib/actions/work-orders";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

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
      <Input
        name="body"
        placeholder="Add a comment…"
        autoComplete="off"
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Post
      </Button>
    </form>
  );
}
