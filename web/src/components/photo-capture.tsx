"use client";

import { useRef, useState, useTransition } from "react";
import {
  attachUploadedFileAction,
  requestUploadUrl,
} from "@/app/work-orders/_actions";

export function PhotoCapture({
  workOrderId,
  kind = "general",
  label = "Add photo",
}: {
  workOrderId: string;
  kind?: "before_photo" | "after_photo" | "general" | "receipt";
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function handle(file: File) {
    setError(null);
    const signed = await requestUploadUrl({
      targetType: "work_order",
      targetId: workOrderId,
      filename: file.name || `photo-${Date.now()}.jpg`,
      contentType: file.type || "image/jpeg",
    });
    if ("error" in signed) {
      setError(signed.error);
      return;
    }
    const put = await fetch(signed.url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    if (!put.ok) {
      setError(`upload_failed_${put.status}`);
      return;
    }
    await attachUploadedFileAction({
      targetType: "work_order",
      targetId: workOrderId,
      storageKey: signed.key,
      contentType: file.type || "image/jpeg",
      filename: file.name,
      sizeBytes: file.size,
      kind,
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          start(() => handle(f));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="w-full rounded border border-dashed border-neutral-400 bg-white px-3 py-3 text-sm font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Uploading…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-rose-700">Error: {error}</p>}
    </div>
  );
}
