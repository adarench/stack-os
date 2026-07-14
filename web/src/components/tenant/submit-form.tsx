"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X, TriangleAlert } from "lucide-react";
import { CategoryGrid } from "./category-grid";
import { Input, Textarea, Label } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkOrderCategory } from "@contracts/work-order-category";
import { createTenantRequestAction } from "@/app/(vendor)/tenant/_actions";

interface Pick {
  id: string;
  file: File;
  url: string;
  isVideo: boolean;
}

export function SubmitForm() {
  const router = useRouter();
  const fileInputId = useId();
  const [category, setCategory] = useState<WorkOrderCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";
  const canSubmit = !!category && title.trim().length > 0 && !busy;

  function addFiles(files: FileList) {
    const next: Pick[] = Array.from(files).map((f) => ({
      id: pickId(),
      file: f,
      url: URL.createObjectURL(f),
      isVideo: (f.type || "").startsWith("video"),
    }));
    setPicks((p) => [...p, ...next]);
  }
  function removePick(id: string) {
    setPicks((p) => {
      const t = p.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return p.filter((x) => x.id !== id);
    });
  }

  async function uploadPick(workOrderId: string, pick: Pick) {
    const body = new FormData();
    body.append("workOrderId", workOrderId);
    body.append("file", pick.file, pick.file.name || `upload-${Date.now()}`);
    const res = await fetch("/api/tenant/uploads/sign", {
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error("upload_sign_failed");
  }

  async function onSubmit() {
    if (!category || !title.trim()) return;
    setError(null);
    setPhase("creating");
    const created = await createTenantRequestAction({
      category,
      title: title.trim(),
      description: description.trim() || undefined,
      priority: emergency ? "urgent" : "normal",
    });
    if (!created.ok) {
      setError(
        created.error === "storage_not_configured"
          ? "Couldn't save right now. Please try again."
          : "Something went wrong. Please try again.",
      );
      setPhase("idle");
      return;
    }
    if (picks.length > 0) {
      setPhase("uploading");
      // Photos are best-effort — the request is already filed.
      for (const p of picks) {
        try {
          await uploadPick(created.id, p);
        } catch {
          /* ignore individual upload failures */
        }
      }
    }
    setPhase("done");
    router.push("/tenant");
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-2">
        <Label>What kind of issue?</Label>
        <CategoryGrid value={category} onChange={setCategory} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">What&apos;s wrong?</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Kitchen sink is leaking"
          maxLength={200}
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Add detail (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="When did it start? Where exactly? Anything we should know."
        />
      </div>

      <div className="space-y-2">
        <Label>Photos or video</Label>
        <input
          id={fileInputId}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          {picks.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {p.isVideo ? (
                <video src={p.url} className="size-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removePick(p.id)}
                aria-label="Remove"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <label
            htmlFor={fileInputId}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-label text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ImagePlus className="size-6" />
            Add
          </label>
        </div>
      </div>

      <button
        type="button"
        aria-pressed={emergency}
        onClick={() => setEmergency((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border px-3 py-3 text-left text-body transition-colors",
          emergency
            ? "border-urgency-overdue/40 bg-urgency-overdue/10 text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted/40",
        )}
      >
        <TriangleAlert className={cn("size-5", emergency ? "text-urgency-overdue" : "text-muted-foreground")} />
        <span>
          <span className="block font-medium text-foreground">This is an emergency</span>
          <span className="block text-label">Flood, no heat, no power, or a safety risk.</span>
        </span>
        <span
          className={cn(
            "ml-auto h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors",
            emergency ? "bg-urgency-overdue" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "block size-5 rounded-full bg-background shadow-sm transition-transform",
              emergency && "translate-x-4",
            )}
          />
        </span>
      </button>

      {error && (
        <p className="rounded-md border border-urgency-overdue/30 bg-urgency-overdue/10 p-3 text-label text-urgency-overdue">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="h-12 w-full text-base"
      >
        {phase === "creating"
          ? "Submitting…"
          : phase === "uploading"
            ? "Uploading photos…"
            : phase === "done"
              ? "Done"
              : "Submit request"}
      </Button>
    </div>
  );
}

function pickId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
