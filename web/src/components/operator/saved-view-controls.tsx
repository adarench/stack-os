"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveViewAction,
  deleteViewAction,
} from "@/app/(app)/work/_actions";

export interface PinnedView {
  id: string;
  name: string;
  params: string;
  pinned: boolean;
  sortOrder: number;
}

/** Sort the params so order-insensitive URLs still match for active-state. */
function normalize(qs: string): string {
  const sp = new URLSearchParams(qs);
  sp.sort();
  return sp.toString();
}

/**
 * Client island for the saved-view bar: renders the operator's pinned lenses
 * as tabs (each links to /work?<params>) plus a "Save view" control that
 * captures the current query string. Built-in lenses stay server-rendered in
 * SavedViewTabs — this only owns the personal, interactive part.
 */
export function SavedViewControls({ views }: { views: PinnedView[] }) {
  const searchParams = useSearchParams();
  const currentQs = normalize(searchParams.toString());
  const pinned = views.filter((v) => v.pinned);

  return (
    <>
      {pinned.map((view) => {
        const isActive = normalize(view.params) === currentQs;
        const href = view.params ? `/work?${view.params}` : "/work";
        return (
          <span
            key={view.id}
            className={cn(
              "inline-flex shrink-0 items-center rounded-md text-body transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Link
              href={href}
              scroll={false}
              className={cn("py-1 pl-3", isActive && "font-medium")}
            >
              {view.name}
            </Link>
            <DeleteButton id={view.id} name={view.name} active={isActive} />
          </span>
        );
      })}
      <SaveControl />
    </>
  );
}

function DeleteButton({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  const [pending, start] = React.useTransition();
  const remove = () =>
    start(async () => {
      const r = await deleteViewAction(id);
      if (r.ok) toast.success(`Removed "${name}"`);
      else toast.error(`Couldn't remove: ${r.error}`);
    });
  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`Remove ${name}`}
      className={cn(
        "ml-0.5 rounded-sm px-1.5 py-1 opacity-60 transition-opacity hover:opacity-100 disabled:opacity-40",
        active ? "hover:text-background" : "hover:text-foreground",
      )}
    >
      <X className="size-3" aria-hidden />
    </button>
  );
}

function SaveControl() {
  const searchParams = useSearchParams();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, start] = React.useTransition();

  const cancel = () => {
    setEditing(false);
    setName("");
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Capture the query string at submit time so it reflects any live edits.
    const params = searchParams.toString();
    start(async () => {
      const r = await saveViewAction({ name: trimmed, params, pinned: true });
      if (r.ok) {
        toast.success(`Saved "${trimmed}"`);
        cancel();
      } else {
        toast.error(`Couldn't save: ${r.error}`);
      }
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-body text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" aria-hidden />
        Save view
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={80}
        placeholder="Name this view"
        className="h-7 w-36 rounded-md border border-border bg-background px-2 text-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !name.trim()}
        className="h-7 shrink-0 rounded-md bg-foreground px-2.5 text-body font-medium text-background transition-opacity disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        onClick={cancel}
        aria-label="Cancel"
        className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
