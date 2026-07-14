"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, UploadCloud, X } from "lucide-react";
import { recordCoiAction } from "@/app/(app)/admin/compliance/_actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

interface VendorOption {
  id: string;
  name: string;
}

interface UploadedDoc {
  storageKey: string;
  contentType: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Client COI record form. Adds two things the old server-action form couldn't:
 * an "Other…" vendor option that creates a lightweight vendor record, and a
 * drag-and-drop PDF dropzone that uploads to storage before the COI is saved.
 */
export function CoiRecordForm({ vendors }: { vendors: VendorOption[] }) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [vendorId, setVendorId] = React.useState("");
  const [newVendorName, setNewVendorName] = React.useState("");
  const [doc, setDoc] = React.useState<UploadedDoc | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<"idle" | "uploading" | "error">("idle");
  const [uploadPct, setUploadPct] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const isOther = vendorId === "__other__";

  async function handleFile(file: File) {
    setError(null);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`File too large (max ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)}MB).`);
      return;
    }
    setUploadState("uploading");
    setUploadPct(0);
    try {
      // The COI row doesn't exist yet, so namespace the storage key under a
      // throwaway draft id. recordCoi re-targets the attachment row to the real
      // COI id at save time; the storage key itself is purely cosmetic.
      const draftId = uuid();
      const res = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "vendor_coi",
          targetId: draftId,
          filename: file.name || "coi.pdf",
          contentType: "application/pdf",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `sign_failed_${res.status}`);
      }
      const signed = (await res.json()) as { url: string; key: string };
      const put = await putWithProgress(signed.url, file, "application/pdf", setUploadPct);
      if (!put.ok) throw new Error(`upload_failed_${put.status}`);
      setDoc({
        storageKey: signed.key,
        contentType: "application/pdf",
        filename: file.name || "coi.pdf",
        sizeBytes: file.size,
      });
      setUploadState("idle");
    } catch (err) {
      setUploadState("error");
      setError((err as Error).message);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const coverageStr = String(fd.get("coverageAmountCents") ?? "");
    setError(null);
    setSubmitting(true);
    const r = await recordCoiAction({
      vendorId: isOther ? "__other__" : vendorId || undefined,
      newVendorName: isOther ? newVendorName : undefined,
      policyNumber: String(fd.get("policyNumber") ?? "") || undefined,
      carrier: String(fd.get("carrier") ?? "") || undefined,
      coverageAmountCents: coverageStr ? Number(coverageStr) : undefined,
      effectiveAt: String(fd.get("effectiveAt") ?? "") || undefined,
      expiresAt: String(fd.get("expiresAt") ?? "") || undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
      upload: doc ?? undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    form.reset();
    setVendorId("");
    setNewVendorName("");
    setDoc(null);
    setUploadPct(0);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-2">
      <Select
        required
        name="vendorId"
        value={vendorId}
        onChange={(e) => setVendorId(e.target.value)}
        className="col-span-2"
      >
        <option value="">— select vendor —</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
        <option value="__other__">Other… (new vendor)</option>
      </Select>
      {isOther && (
        <Input
          name="newVendorName"
          value={newVendorName}
          onChange={(e) => setNewVendorName(e.target.value)}
          placeholder="New vendor name"
          className="col-span-2"
          required
        />
      )}
      <Input name="policyNumber" placeholder="Policy number" />
      <Input name="carrier" placeholder="Carrier" />
      <Input name="coverageAmountCents" type="number" min={0} placeholder="Coverage (¢)" />
      <Input name="effectiveAt" type="date" />
      <Input name="expiresAt" type="date" className="col-span-2" />
      <Textarea name="notes" rows={2} placeholder="Notes" className="col-span-2" />

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      {doc ? (
        <div className="col-span-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-body">
          <FileText className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground" title={doc.filename}>
            {doc.filename}
          </span>
          <Badge tone="done">attached</Badge>
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => setDoc(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "col-span-2 flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-6 text-label transition-colors",
            dragging
              ? "border-foreground bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/40",
          )}
        >
          <UploadCloud className="size-5" />
          {uploadState === "uploading"
            ? `Uploading… ${Math.round(uploadPct * 100)}%`
            : "Drag & drop a PDF, or click to browse"}
        </button>
      )}

      {error && (
        <p className="col-span-2 text-label text-urgency-overdue" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="col-span-2"
        disabled={submitting || uploadState === "uploading"}
      >
        {submitting ? "Recording…" : "Record COI"}
      </Button>
    </form>
  );
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** XHR PUT with upload progress — mirrors the helper in photo-capture.tsx. */
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
      if (e.lengthComputable) onProgress(e.loaded / e.total);
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
