"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Field photo upload for technicians. `capture="environment"` opens the rear
 * camera on a phone so Oscar/Fernando can snap and send from the jobsite.
 * Assignment is enforced server-side (/api/tech/uploads → techAttachPhoto).
 */
export function TechPhotoUpload({ woRef }: { woRef: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("ref", woRef);
      body.append("file", file);
      const res = await fetch("/api/tech/uploads", { method: "POST", body });
      if (res.ok) {
        router.refresh();
      } else {
        setError("Couldn't upload that photo. Try again.");
      }
    } catch {
      setError("Couldn't upload that photo. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition-colors active:bg-muted disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Add photo"}
      </button>
      {error && <p className="mt-1 text-xs text-urgency-overdue">{error}</p>}
    </div>
  );
}
