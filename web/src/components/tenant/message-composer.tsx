"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { sendTenantMessageAction } from "@/app/(vendor)/tenant/_actions";

export function MessageComposer({
  workOrderId,
  refId,
}: {
  workOrderId: string;
  refId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const r = await sendTenantMessageAction(refId, workOrderId, body);
      if (r.ok) {
        setBody("");
        router.refresh();
      } else {
        // Keep the typed text; tell the resident it didn't send (offline/flaky cell).
        setError(r.error ?? "Couldn't send — check your connection and try again.");
      }
    });
  }

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 text-label text-urgency-overdue" role="alert">{error}</p>
      )}
      <div className="flex items-end gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Message the team…"
        enterKeyHint="send"
        autoCapitalize="sentences"
        className="flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button
        type="button"
        onClick={send}
        disabled={pending || !body.trim()}
        className="h-10 shrink-0"
      >
        {pending ? "Sending…" : "Send"}
      </Button>
      </div>
    </div>
  );
}
