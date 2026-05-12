"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeSince } from "./time-since";
import { UrgencyDot, type Urgency } from "./urgency-dot";

interface EntityDetail {
  ref: string;
  type: "wo" | "ins" | "prj";
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  property: { name: string } | null;
  unit: { label: string } | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  legacyHref: string;
  activity: Array<{ id: string; action: string; actorType: string; at: string }>;
  costs: Array<{
    id: string;
    kind: string;
    amountCents: string;
    description: string | null;
    at: string;
  }>;
  files: Array<{
    id: string;
    filename: string | null;
    kind: string;
    sizeBytes: number | null;
    at: string;
  }>;
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "ready"; data: EntityDetail }
  | { kind: "error"; ref: string; message: string };

/**
 * Right-side detail drawer driven by `?d=<ref>` querystring.
 *
 * On open, fetches `/api/me/entity?ref=<ref>` and renders Overview / Activity
 * / Costs / Files tabs. Footer holds a single "Open full page" escape hatch
 * to the legacy detail surface — full action bar (Assign / Status → /
 * Comment) lands once those actions exist as drawer-native operations.
 */
export function EntityDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("d");

  const [state, setState] = React.useState<State>({ kind: "idle" });

  React.useEffect(() => {
    if (!ref) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading", ref });
    fetch(`/api/me/entity?ref=${encodeURIComponent(ref)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) {
          setState({ kind: "error", ref, message: "Not found." });
          return;
        }
        if (!r.ok) {
          setState({
            kind: "error",
            ref,
            message: `Couldn't load (${r.status}).`,
          });
          return;
        }
        const data = (await r.json()) as EntityDetail;
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: "error",
          ref,
          message: err instanceof Error ? err.message : "Network error.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const close = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("d");
    const next = sp.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [router, searchParams]);

  return (
    <Sheet
      open={!!ref}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <SheetContent className="flex flex-col p-0" hideCloseButton>
        <SheetHeader className="flex-row items-center gap-2">
          <UrgencyDot urgency={statusUrgency(state)} />
          <SheetTitle className="font-mono text-sm">
            {ref ?? ""}
          </SheetTitle>
          {state.kind === "ready" && (
            <span className="truncate text-sm text-muted-foreground">
              · {state.data.title}
            </span>
          )}
          <SheetDescription className="sr-only">
            Entity detail with Overview, Activity, Costs, and Files tabs.
          </SheetDescription>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={close}
            aria-label="Close"
          >
            <X />
          </Button>
        </SheetHeader>

        {state.kind === "loading" && (
          <DrawerSkeleton />
        )}

        {state.kind === "error" && (
          <div className="flex-1 p-4 text-sm text-muted-foreground">
            {state.message}
          </div>
        )}

        {state.kind === "ready" && (
          <Tabs
            defaultValue="overview"
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">
                Activity{" "}
                <span className="ml-1 font-mono text-[10px] tabular-nums">
                  {state.data.activity.length}
                </span>
              </TabsTrigger>
              {state.data.type === "wo" && (
                <TabsTrigger value="costs">
                  Costs{" "}
                  <span className="ml-1 font-mono text-[10px] tabular-nums">
                    {state.data.costs.length}
                  </span>
                </TabsTrigger>
              )}
              <TabsTrigger value="files">
                Files{" "}
                <span className="ml-1 font-mono text-[10px] tabular-nums">
                  {state.data.files.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab data={state.data} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab data={state.data} />
            </TabsContent>
            {state.data.type === "wo" && (
              <TabsContent value="costs">
                <CostsTab data={state.data} />
              </TabsContent>
            )}
            <TabsContent value="files">
              <FilesTab data={state.data} />
            </TabsContent>
          </Tabs>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span>
            Press{" "}
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              esc
            </kbd>{" "}
            to close
          </span>
          {state.kind === "ready" && state.data.dueAt && (
            <span className="flex items-center gap-1">
              <span>Due</span>
              <TimeSince at={state.data.dueAt} direction="auto" />
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function statusUrgency(state: State): Urgency {
  if (state.kind !== "ready") return "muted";
  const s = state.data.status;
  if (s === "blocked") return "blocked";
  if (s === "in_progress") return "inflow";
  if (s === "closed" || s === "verified" || s === "reviewed") return "done";
  return "muted";
}

function OverviewTab({ data }: { data: EntityDetail }) {
  const subtitle = [data.property?.name, data.unit?.label]
    .filter(Boolean)
    .join(" · ");
  return (
    <dl className="space-y-3">
      <Field label="Title">{data.title}</Field>
      {subtitle && <Field label="Location">{subtitle}</Field>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <span className="inline-flex items-center gap-1.5">
            <UrgencyDot urgency={statusUrgency({ kind: "ready", data })} />
            <span className="capitalize">{data.status.replace(/_/g, " ")}</span>
          </span>
        </Field>
        {data.priority && (
          <Field label="Priority">
            <span className="capitalize">{data.priority}</span>
          </Field>
        )}
        {data.dueAt && (
          <Field label="Due">
            <span className="font-mono text-xs">
              {new Date(data.dueAt).toLocaleString()}
            </span>
            <TimeSince at={data.dueAt} />
          </Field>
        )}
        <Field label="Updated">
          <TimeSince at={data.updatedAt} />
        </Field>
      </div>
      {data.description && (
        <Field label="Description">
          <p className="whitespace-pre-wrap text-sm">{data.description}</p>
        </Field>
      )}
    </dl>
  );
}

function ActivityTab({ data }: { data: EntityDetail }) {
  if (data.activity.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {data.activity.map((a) => (
        <li key={a.id} className="flex items-start gap-2 text-sm">
          <span className="mt-1 size-1.5 rounded-full bg-muted-foreground" />
          <span className="flex-1">
            <span className="font-medium capitalize">
              {a.action.replace(/_/g, " ")}
            </span>{" "}
            <span className="text-muted-foreground">
              by {a.actorType}
            </span>
          </span>
          <TimeSince at={a.at} />
        </li>
      ))}
    </ul>
  );
}

function CostsTab({ data }: { data: EntityDetail }) {
  if (data.costs.length === 0) {
    return <p className="text-sm text-muted-foreground">No costs entered.</p>;
  }
  const total = data.costs.reduce((s, c) => s + Number(c.amountCents), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between border-b border-border pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Total
        </span>
        <span className="font-mono text-lg tabular-nums">
          ${(total / 100).toFixed(2)}
        </span>
      </div>
      <ul className="space-y-1">
        {data.costs.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="flex-1">
              <span className="text-muted-foreground capitalize">{c.kind}</span>
              {c.description && <span> · {c.description}</span>}
            </span>
            <span className="font-mono tabular-nums">
              ${(Number(c.amountCents) / 100).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilesTab({ data }: { data: EntityDetail }) {
  if (data.files.length === 0) {
    return <p className="text-sm text-muted-foreground">No files uploaded.</p>;
  }
  return (
    <ul className="space-y-1">
      {data.files.map((f) => (
        <li key={f.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1 truncate">
            {f.filename ?? f.id.slice(0, 8)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {f.kind}
          </span>
          {f.sizeBytes && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatSize(f.sizeBytes)}
            </span>
          )}
          <TimeSince at={f.at} />
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-2 text-sm">
        {children}
      </dd>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex-1 space-y-3 p-4">
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}
