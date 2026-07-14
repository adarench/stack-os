"use client";

import { useRef, useState } from "react";
import {
  attachUploadedFileAction,
  requestUploadUrl,
} from "@/lib/actions/work-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
        id: uploadItemId(),
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
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="h-auto w-full border-dashed py-3"
      >
        {isUploading ? "Uploading…" : label}
      </Button>

      {items.length > 0 && (
        <ul className="mt-2 divide-y divide-border/50">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 px-2 py-2.5 text-body hover:bg-muted/40"
            >
              <span className="flex-1 truncate text-foreground" title={it.filename}>
                {it.filename}
              </span>
              {it.status === "queued" && <Badge tone="muted">queued</Badge>}
              {it.status === "uploading" && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-12 overflow-hidden rounded bg-muted">
                    <span
                      className="block h-full bg-foreground transition-[width]"
                      style={{ width: `${Math.round(it.progress * 100)}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(it.progress * 100)}%
                  </span>
                </span>
              )}
              {it.status === "done" && <Badge tone="done">done</Badge>}
              {it.status === "error" && (
                <Badge tone="overdue" title={it.error}>
                  error: {it.error}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function uploadItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
