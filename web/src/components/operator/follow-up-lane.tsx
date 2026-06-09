"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimeSince } from "./time-since";
import { cn } from "@/lib/utils";
import {
  addFollowUpAction,
  resolveFollowUpAction,
  snoozeFollowUpAction,
} from "@/app/(app)/now/actions";

export interface FollowUpItem {
  id: string;
  title: string;
  sourceChannel: "trello" | "email" | "text" | "appfolio" | "manual";
  sourceUrl: string | null;
  nextAction: string | null;
  ownerName: string | null;
  followUpAt: string | null;
  lastTouchedAt: string | null;
  targetRef: string | null;
}

/**
 * Follow-up needed — the Trello/email/text replacement lane. "What would
 * otherwise fall through the cracks." Each row is actionable in place: mark
 * followed-up, snooze, or jump to the related work — no page-hopping.
 */
export function FollowUpLane({ items }: { items: FollowUpItem[] }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <section className="mb-2 border-t border-border pt-2">
      <div className="flex items-baseline gap-2 px-2 pb-1">
        <h2 className="text-[13px] font-semibold text-foreground">
          Follow-up needed
        </h2>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
        >
          {adding ? "cancel" : "+ add"}
        </button>
      </div>
      {adding && <QuickAdd onDone={() => setAdding(false)} />}
      <div className="space-y-0">
        {items.length === 0 && !adding && (
          <p className="px-2 py-1 text-[12px] text-muted-foreground">
            Nothing to chase. Add a follow-up when something needs a nudge.
          </p>
        )}
        {items.map((it) => (
          <FollowUpRow key={it.id} item={it} />
        ))}
      </div>
    </section>
  );
}

function QuickAdd({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = React.useState("");
  const [pending, start] = React.useTransition();
  const submit = () => {
    if (!title.trim()) return;
    start(async () => {
      const r = await addFollowUpAction({ title: title.trim() });
      if (r.ok) {
        toast.success("Follow-up added");
        setTitle("");
        onDone();
      } else {
        toast.error(`Couldn't add: ${r.error}`);
      }
    });
  };
  return (
    <div className="flex items-center gap-2 px-2 pb-1.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="e.g. Text Northstar for flooring ETA"
        className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      <Button type="button" size="sm" disabled={pending || !title.trim()} onClick={submit}>
        Add
      </Button>
    </div>
  );
}

function FollowUpRow({ item }: { item: FollowUpItem }) {
  const [pending, start] = React.useTransition();
  const done = () =>
    start(async () => {
      const r = await resolveFollowUpAction(item.id);
      if (r.ok) toast.success("Marked done");
      else toast.error(`Couldn't update: ${r.error}`);
    });
  const snooze = () =>
    start(async () => {
      const r = await snoozeFollowUpAction(item.id, 1);
      if (r.ok) toast.success("Snoozed 1 day");
      else toast.error(`Couldn't snooze: ${r.error}`);
    });

  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-muted/40">
      <SourceChip channel={item.sourceChannel} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-foreground">{item.title}</span>
          {item.targetRef && (
            <Link
              href={`?d=${item.targetRef}`}
              scroll={false}
              data-ref={item.targetRef}
              className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground hover:underline"
            >
              {item.targetRef}
            </Link>
          )}
        </div>
        <div className="flex items-baseline gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          {item.nextAction && (
            <span className="truncate text-foreground/70">{item.nextAction}</span>
          )}
          <span className="shrink-0">{item.ownerName ?? "unassigned"}</span>
          {item.lastTouchedAt && (
            <span className="shrink-0">
              · touched <TimeSince at={item.lastTouchedAt} className="inline" />
            </span>
          )}
        </div>
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={snooze}>
          Snooze
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={done}>
          Done
        </Button>
      </span>
    </div>
  );
}

function SourceChip({ channel }: { channel: FollowUpItem["sourceChannel"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider",
        channel === "trello"
          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
          : channel === "manual"
            ? "bg-muted text-muted-foreground"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      {channel}
    </span>
  );
}
