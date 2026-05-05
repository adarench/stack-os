"use client";

import { useRef, useState } from "react";
import {
  attachUploadedFileAction,
  requestUploadUrl,
} from "@/app/(app)/work-orders/_actions";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type Kind = "before_photo" | "after_photo" | "general" | "receipt";

interface UploadItem {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number; // 0..1
  error?: string;
}

export function PhotoCapture({
  workOrderId,
  kind = "general",
  label = "Add photo",
}: {
  workOrderId: string;
  kind?: Kind;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  function update(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function uploadOne(item: UploadItem, file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      update(item.id, {
        status: "error",
        error: `File too large (max ${Math.floor(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB)`,
      });
      return;
    }
    update(item.id, { status: "uploading", progress: 0 });

    let signed = await requestUploadUrl({
      targetType: "work_order",
      targetId: workOrderId,
      filename: item.filename,
      contentType: item.contentType,
    });
    if ("error" in signed) {
      update(item.id, { status: "error", error: signed.error });
      return;
    }

    const putResult = await putWithProgress(signed.url, file, item.contentType, (p) =>
      update(item.id, { progress: p }),
    );
    if (!putResult.ok && putResult.status === 403) {
      // Signed URL likely expired between request and upload — refresh once.
      signed = await requestUploadUrl({
        targetType: "work_order",
        targetId: workOrderId,
        filename: item.filename,
        contentType: item.contentType,
      });
      if ("error" in signed) {
        update(item.id, { status: "error", error: signed.error });
        return;
      }
      const retry = await putWithProgress(signed.url, file, item.contentType, (p) =>
        update(item.id, { progress: p }),
      );
      if (!retry.ok) {
        update(item.id, { status: "error", error: `upload_failed_${retry.status}` });
        return;
      }
    } else if (!putResult.ok) {
      update(item.id, { status: "error", error: `upload_failed_${putResult.status}` });
      return;
    }

    try {
      await attachUploadedFileAction({
        targetType: "work_order",
        targetId: workOrderId,
        storageKey: signed.key,
        contentType: item.contentType,
        filename: item.filename,
        sizeBytes: item.sizeBytes,
        kind,
      });
      update(item.id, { status: "done", progress: 1 });
    } catch (err) {
      update(item.id, { status: "error", error: (err as Error).message });
    }
  }

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    const newItems: Array<{ item: UploadItem; file: File }> = list.map((f) => ({
      item: {
        id: crypto.randomUUID(),
        filename: f.name || `photo-${Date.now()}.jpg`,
        sizeBytes: f.size,
        contentType: f.type || "image/jpeg",
        status: "queued",
        progress: 0,
      },
      file: f,
    }));
    setItems((prev) => [...prev, ...newItems.map((n) => n.item)]);
    setIsUploading(true);
    for (const { item, file } of newItems) {
      // Sequential uploads to keep progress UI simple and avoid racing the
      // server action that revalidates after each attachment row insert.
      await uploadOne(item, file);
    }
    setIsUploading(false);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => {
          const fl = e.target.files;
          if (!fl || fl.length === 0) return;
          void handleFiles(fl);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="w-full rounded border border-dashed border-neutral-400 bg-white px-3 py-3 text-sm font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-50"
      >
        {isUploading ? "Uploading…" : label}
      </button>

      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1 text-xs"
            >
              <span className="flex-1 truncate" title={it.filename}>
                {it.filename}
              </span>
              {it.status === "queued" && <span className="text-neutral-500">queued</span>}
              {it.status === "uploading" && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-12 overflow-hidden rounded bg-neutral-200">
                    <span
                      className="block h-full bg-neutral-700 transition-[width]"
                      style={{ width: `${Math.round(it.progress * 100)}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-neutral-500">
                    {Math.round(it.progress * 100)}%
                  </span>
                </span>
              )}
              {it.status === "done" && <span className="text-emerald-700">done</span>}
              {it.status === "error" && (
                <span className="text-rose-700" title={it.error}>
                  error: {it.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (ok) onProgress(1);
      resolve({ ok, status: xhr.status });
    };
    xhr.onerror = () => resolve({ ok: false, status: xhr.status || 0 });
    xhr.onabort = () => resolve({ ok: false, status: 0 });
    xhr.send(file);
  });
}
