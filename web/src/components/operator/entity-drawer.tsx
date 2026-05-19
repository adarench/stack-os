"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeSince } from "./time-since";
import { UrgencyDot, type Urgency } from "./urgency-dot";
import { cn } from "@/lib/utils";
import {
  approvalReasonLabel,
  auditActionLabel,
  workOrderStatusLabel,
  workOrderTransitionLabel,
} from "@/lib/labels";
import {
  addCommentAction,
  decideApprovalAction,
  setStatusAction,
} from "@/app/(app)/_drawer/actions";

/* -------------------- types (mirror server-side EntityDetail) -------- */

interface CommentItem {
  id: string;
  body: string;
  actorType: string;
  actorName: string | null;
  visibility: "internal" | "external";
  at: string;
}

interface ActivityItem {
  id: string;
  action: string;
  actorType: string;
  actorName: string | null;
  at: string;
  diff: unknown;
}

interface UnitHistoryC {
  countLast90d: number;
  countAllTime: number;
  topTradeHint: string | null;
  previousResolved: { ref: string; title: string; resolvedAt: string } | null;
}

interface VendorReliabilityC {
  vendorId: string;
  vendorName: string;
  sampleSize: number;
  onTimeRate: number | null;
  overdueCompletions: number;
  activeCount: number;
  activeStressed: number;
}

interface SiblingWorkItemC {
  ref: string;
  title: string;
  status: string;
  dueAt: string | null;
  unitLabel: string | null;
}

interface TenantContextC {
  name: string | null;
  email: string | null;
  unitTicketCount: number;
}

interface InspectionLineageC {
  ref: string;
  kind: string;
  openFindingsCount: number;
}

interface DispatchEventC {
  status: string;
  at: string;
}

interface EntityDetail {
  ref: string;
  type: "wo" | "ins" | "prj" | "approval";
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
  activity: ActivityItem[];
  comments: CommentItem[];
  nextStatuses: string[];
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
  reason?: string;
  amountCents?: string | null;
  linkedWo?: {
    ref: string;
    title: string;
    status: string;
    dueAt: string | null;
  };
  pendingApprovals?: Array<{
    id: string;
    ref: string;
    reason: string;
    amountCents: string | null;
    createdAt: string;
  }>;
  unitHistory?: UnitHistoryC | null;
  vendorReliability?: VendorReliabilityC | null;
  siblingWork?: SiblingWorkItemC[];
  tenantContext?: TenantContextC | null;
  inspectionLineage?: InspectionLineageC | null;
  dispatchTimeline?: DispatchEventC[];
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "ready"; data: EntityDetail }
  | { kind: "error"; ref: string; message: string };

/**
 * Right-side cockpit. Open via `?d=<ref>`. The drawer is where most
 * operational work happens: read context, comment, change status, approve.
 *
 * Refresh model: server actions call revalidatePath() to keep the parent
 * surface fresh; the drawer itself bumps a `refreshKey` to re-fetch its
 * own data after a mutation lands.
 */
export function EntityDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("d");

  const [state, setState] = React.useState<State>({ kind: "idle" });
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!ref) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState((s) =>
      s.kind === "ready" && s.data.ref === ref ? s : { kind: "loading", ref },
    );
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
  }, [ref, refreshKey]);

  const refetch = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  const close = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("d");
    const next = sp.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [router, searchParams]);

  if (!ref) return null;

  return (
    <div
      role="complementary"
      aria-label="Entity detail"
      className="flex h-full flex-col bg-background"
    >
      <header className="flex flex-row items-center gap-2 border-b border-border px-4 py-3">
        <UrgencyDot urgency={statusUrgency(state)} />
        <h2 className="font-mono text-sm" data-ref={ref ?? undefined}>{ref ?? ""}</h2>
        {state.kind === "ready" && (
          <span className="truncate text-sm text-muted-foreground">
            · {drawerTitle(state.data)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={close}
          aria-label="Close"
        >
          <X />
        </Button>
      </header>

      {state.kind === "loading" && <DrawerSkeleton />}
      {state.kind === "error" && (
        <div className="flex-1 px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && state.data.type === "approval" && (
        <ApprovalCockpit data={state.data} onMutated={refetch} />
      )}

      {state.kind === "ready" && state.data.type !== "approval" && (
        <WorkCockpit data={state.data} onMutated={refetch} />
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
    </div>
  );
}

/* -------------------- WO / INS / PRJ cockpit -------------------- */

function WorkCockpit({
  data,
  onMutated,
}: {
  data: EntityDetail;
  onMutated: () => void;
}) {
  return (
    <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
      <TabsList className="border-b border-border px-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="timeline">
          Timeline{" "}
          <span className="ml-1 font-mono text-[10px] tabular-nums">
            {data.activity.length + data.comments.length}
          </span>
        </TabsTrigger>
        {/* Empty tabs vanish — operator surface stays dense and intentional. */}
        {data.type === "wo" && data.costs.length > 0 && (
          <TabsTrigger value="costs">
            Costs{" "}
            <span className="ml-1 font-mono text-[10px] tabular-nums">
              {data.costs.length}
            </span>
          </TabsTrigger>
        )}
        {data.files.length > 0 && (
          <TabsTrigger value="files">
            Files{" "}
            <span className="ml-1 font-mono text-[10px] tabular-nums">
              {data.files.length}
            </span>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 py-3">
        <WorkOverview data={data} onMutated={onMutated} />
      </TabsContent>
      <TabsContent value="timeline" className="flex flex-1 flex-col overflow-hidden">
        <TimelineFeed data={data} onMutated={onMutated} />
      </TabsContent>
      {data.type === "wo" && data.costs.length > 0 && (
        <TabsContent value="costs" className="flex-1 overflow-y-auto px-4 py-3">
          <CostsList data={data} />
        </TabsContent>
      )}
      {data.files.length > 0 && (
        <TabsContent value="files" className="flex-1 overflow-y-auto px-4 py-3">
          <FilesList data={data} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function WorkOverview({
  data,
  onMutated,
}: {
  data: EntityDetail;
  onMutated: () => void;
}) {
  const subtitle = [data.property?.name, data.unit?.label]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-4">
      {/* Title already lives in the drawer header — don't repeat it. */}
      {subtitle && <Field label="Location">{subtitle}</Field>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <span className="inline-flex items-center gap-1.5">
            <UrgencyDot urgency={statusUrgencyOf(data.status)} />
            <span>{workOrderStatusLabel(data.status)}</span>
          </span>
        </Field>
        {data.priority && (
          <Field label="Priority">
            <span className="lowercase">{data.priority}</span>
          </Field>
        )}
        {data.dueAt && (
          <Field label="Due">
            <span className="font-mono text-xs">
              {compactDate(data.dueAt)}
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

      {data.pendingApprovals && data.pendingApprovals.length > 0 && (
        <Field label="Waiting on sign-off">
          <ul className="w-full space-y-1">
            {data.pendingApprovals.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs"
              >
                <Link
                  href={`?d=${a.ref}`}
                  scroll={false}
                  data-ref={a.ref}
                  className="font-mono tabular-nums text-foreground hover:underline"
                >
                  {a.ref}
                </Link>
                <span className="text-muted-foreground">
                  {approvalReasonLabel(a.reason)}
                </span>
                {a.amountCents && (
                  <span className="font-mono tabular-nums">
                    ${(Number(a.amountCents) / 100).toFixed(0)}
                  </span>
                )}
                <span className="ml-auto font-mono tabular-nums text-urgency-blocked">
                  pending
                </span>
              </li>
            ))}
          </ul>
        </Field>
      )}

      <InspectionLineageBlock lineage={data.inspectionLineage} />
      <TenantBlock tenant={data.tenantContext} />
      <UnitHistoryBlock history={data.unitHistory} unitLabel={data.unit?.label} property={data.property?.name} />
      <VendorBlock reliability={data.vendorReliability} />
      <SiblingWorkBlock items={data.siblingWork} propertyName={data.property?.name} />
      <DispatchTimelineBlock events={data.dispatchTimeline} />

      {data.type === "wo" && data.nextStatuses.length > 0 && (
        <Field label="Move this">
          <StatusButtons
            ref={data.ref}
            current={data.status}
            options={data.nextStatuses}
            onMutated={onMutated}
          />
        </Field>
      )}
    </div>
  );
}

/* -------------------- memory blocks -------------------- */

/**
 * Recurrence + tenant context for the unit this WO sits on. Renders only
 * when there's a real signal (≥1 prior WO in the window). Reads as prose:
 * "3 WOs in 90d (2 plumbing) · last: WO-1023 resolved 14d ago".
 */
function UnitHistoryBlock({
  history,
  unitLabel,
  property,
}: {
  history?: UnitHistoryC | null;
  unitLabel?: string;
  property?: string;
}) {
  if (!history || history.countLast90d === 0) return null;
  const heading = [property, unitLabel].filter(Boolean).join(" · ");
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Unit history{heading && ` · ${heading}`}
      </div>
      <div className="mt-1 space-y-0.5 font-mono text-[11px] tabular-nums text-foreground/90">
        <div>
          <span className={cn(history.countLast90d >= 3 && "text-urgency-blocked")}>
            {history.countLast90d}
          </span>{" "}
          <span className="text-muted-foreground">
            {history.countLast90d === 1 ? "WO" : "WOs"} in 90d
            {history.topTradeHint && (
              <span className="text-foreground/70">
                {" "}
                · mostly {history.topTradeHint}
              </span>
            )}
          </span>
        </div>
        {history.previousResolved && (
          <div className="text-muted-foreground">
            previous:{" "}
            <Link
              href={`?d=${history.previousResolved.ref}`}
              scroll={false}
              data-ref={history.previousResolved.ref}
              className="text-foreground hover:underline"
            >
              {history.previousResolved.ref}
            </Link>{" "}
            resolved <TimeSince at={history.previousResolved.resolvedAt} className="inline" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Vendor reliability + current load. Statistics gated on min sample —
 * "100% over 1 job" is noise, not signal. Always reads as compact prose;
 * never a meter, never a star rating.
 */
function VendorBlock({ reliability }: { reliability?: VendorReliabilityC | null }) {
  if (!reliability) return null;
  const { vendorName, sampleSize, onTimeRate, overdueCompletions, activeCount, activeStressed } =
    reliability;

  // Nothing useful to say.
  if (sampleSize === 0 && activeCount === 0) return null;

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Vendor · {vendorName}
      </div>
      <div className="mt-1 space-y-0.5 font-mono text-[11px] tabular-nums text-foreground/90">
        {onTimeRate !== null && (
          <div>
            <span
              className={cn(
                onTimeRate >= 0.9
                  ? "text-foreground"
                  : onTimeRate >= 0.7
                    ? "text-urgency-blocked"
                    : "text-urgency-overdue",
              )}
            >
              {Math.round(onTimeRate * 100)}% on-time
            </span>{" "}
            <span className="text-muted-foreground">
              over {sampleSize} jobs (30d)
              {overdueCompletions > 0 && (
                <span className="text-urgency-blocked">
                  {" "}
                  · {overdueCompletions} late
                </span>
              )}
            </span>
          </div>
        )}
        {activeCount > 0 && (
          <div className="text-muted-foreground">
            <span className="text-foreground">{activeCount}</span> active
            {activeStressed > 0 && (
              <span className="text-urgency-overdue">
                {" "}
                · {activeStressed} blocked or overdue
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sibling work at the same property. Operator sees "also here at 247
 * Maple" so they can batch trips or notice clustering. Renders only when
 * non-empty.
 */
function SiblingWorkBlock({
  items,
  propertyName,
}: {
  items?: SiblingWorkItemC[];
  propertyName?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Also here{propertyName && ` · ${propertyName}`}
      </div>
      <ul className="mt-1 space-y-0.5">
        {items.map((s) => (
          <li
            key={s.ref}
            className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums"
          >
            <Link
              href={`?d=${s.ref}`}
              scroll={false}
              data-ref={s.ref}
              className="shrink-0 text-foreground hover:underline"
            >
              {s.ref}
            </Link>
            <span className="min-w-0 flex-1 truncate text-foreground/80">
              {s.title}
            </span>
            {s.unitLabel && (
              <span className="shrink-0 text-muted-foreground">{s.unitLabel}</span>
            )}
            <span
              className={cn(
                "shrink-0 uppercase tracking-wider text-[10px]",
                s.status === "blocked" && "text-urgency-blocked",
                s.dueAt && new Date(s.dueAt) < new Date() && "text-urgency-overdue",
              )}
            >
              {workOrderStatusLabel(s.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusButtons({
  ref,
  current,
  options,
  onMutated,
}: {
  ref: string;
  current: string;
  options: string[];
  onMutated: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const move = (to: string) => {
    startTransition(async () => {
      const r = await setStatusAction({ ref, to });
      if (r.ok) {
        toast.success(`${ref} → ${workOrderStatusLabel(to)}`);
        onMutated();
      } else {
        toast.error(`Couldn't move: ${r.error}`);
      }
    });
  };
  // Don't suggest moving back to current.
  const visible = options.filter((s) => s !== current);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((to) => (
        <Button
          key={to}
          type="button"
          size="sm"
          variant={primaryTransition(current, to) ? "default" : "outline"}
          disabled={pending}
          onClick={() => move(to)}
        >
          {workOrderTransitionLabel(to)}
        </Button>
      ))}
    </div>
  );
}

/** Pick which transition is the "obvious next" one — slightly weighted UI. */
function primaryTransition(current: string, to: string): boolean {
  if (current === "new" && to === "triaged") return true;
  if (current === "triaged" && to === "assigned") return true;
  if (current === "assigned" && to === "scheduled") return true;
  if (current === "scheduled" && to === "in_progress") return true;
  if (current === "in_progress" && to === "resolved") return true;
  if (current === "resolved" && to === "verified") return true;
  if (current === "verified" && to === "closed") return true;
  return false;
}

/* -------------------- timeline (audit + comments + composer) -------- */

function TimelineFeed({
  data,
  onMutated,
}: {
  data: EntityDetail;
  onMutated: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {data.activity.length === 0 && data.comments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No timeline yet. Add a comment to start coordinating.
          </p>
        )}

        {data.comments.length > 0 && (
          <ul className="space-y-2">
            {data.comments.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  c.visibility === "external"
                    ? "border-urgency-blocked/40 bg-urgency-blocked/5"
                    : "border-border bg-muted/30",
                )}
              >
                <div className="mb-1 flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="text-foreground">
                    {c.actorName ?? c.actorType}
                  </span>
                  <span>·</span>
                  <span>{c.visibility === "external" ? "with vendor" : "internal"}</span>
                  <TimeSince at={c.at} className="ml-auto" />
                </div>
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        {data.activity.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Audit
            </h4>
            <ul className="space-y-1">
              {data.activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums text-muted-foreground"
                >
                  <TimeSince at={a.at} className="w-10 shrink-0 text-right" />
                  <span className="w-16 shrink-0 truncate text-foreground/90">
                    {a.actorName ?? a.actorType}
                  </span>
                  <span className="truncate">
                    {auditActionLabel(a.action)}
                    {diffNote(a.diff) && (
                      <span className="ml-1 text-foreground/80">
                        {diffNote(a.diff)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CommentComposer entityRef={data.ref} onPosted={onMutated} />
    </div>
  );
}

function CommentComposer({
  entityRef,
  onPosted,
}: {
  entityRef: string;
  onPosted: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [visibility, setVisibility] = React.useState<"internal" | "external">(
    "internal",
  );
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (!body.trim()) return;
    startTransition(async () => {
      const r = await addCommentAction({ ref: entityRef, body, visibility });
      if (r.ok) {
        setBody("");
        toast.success(
          visibility === "external"
            ? "Comment posted (visible to vendor)"
            : "Comment posted",
        );
        onPosted();
      } else {
        toast.error(`Couldn't post: ${r.error}`);
      }
    });
  };

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-3">
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note for the team…"
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setVisibility((v) => (v === "internal" ? "external" : "internal"))
          }
          className={cn(
            "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
            visibility === "external"
              ? "bg-urgency-blocked/15 text-urgency-blocked"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {visibility === "external" ? "visible to vendor" : "internal"}
        </button>
        <span className="text-[10px] text-muted-foreground">
          ⌘↵ to post
        </span>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={pending || !body.trim()}
          onClick={submit}
        >
          Post
        </Button>
      </div>
    </div>
  );
}

/* -------------------- approval cockpit -------------------- */

function ApprovalCockpit({
  data,
  onMutated,
}: {
  data: EntityDetail;
  onMutated: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const decide = (to: "approved" | "rejected") => {
    startTransition(async () => {
      const r = await decideApprovalAction({ ref: data.ref, to });
      if (r.ok) {
        toast.success(to === "approved" ? "Signed off" : "Rejected");
        onMutated();
      } else {
        toast.error(`Couldn't decide: ${r.error}`);
      }
    });
  };

  return (
    <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
      <TabsList className="border-b border-border px-3">
        <TabsTrigger value="overview">Decision</TabsTrigger>
        <TabsTrigger value="timeline">
          Timeline{" "}
          <span className="ml-1 font-mono text-[10px] tabular-nums">
            {data.comments.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          <Field label="Reason">
            <span className="font-medium">
              {data.reason ? approvalReasonLabel(data.reason) : "—"}
            </span>
          </Field>
          {data.amountCents && (
            <Field label="Amount">
              <span className="font-mono text-xl tabular-nums">
                ${(Number(data.amountCents) / 100).toFixed(2)}
              </span>
            </Field>
          )}
          <Field label="Pending since">
            <span className="text-sm">{humanizeAgo(data.createdAt)}</span>
          </Field>
          {data.description && (
            <Field label="Notes">
              <p className="whitespace-pre-wrap text-sm">{data.description}</p>
            </Field>
          )}
          {data.linkedWo && (
            <Field label="Will unblock">
              <Link
                href={`?d=${data.linkedWo.ref}`}
                scroll={false}
                data-ref={data.linkedWo.ref}
                className="block w-full rounded-md border border-border bg-card px-3 py-2 hover:bg-accent"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs tabular-nums">
                    {data.linkedWo.ref}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {workOrderStatusLabel(data.linkedWo.status)}
                  </span>
                  {data.linkedWo.dueAt &&
                    new Date(data.linkedWo.dueAt).getTime() < Date.now() && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-urgency-overdue">
                        overdue
                      </span>
                    )}
                </div>
                <p className="mt-1 truncate text-sm">{data.linkedWo.title}</p>
              </Link>
            </Field>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => decide("approved")}
              className="bg-urgency-done text-white hover:bg-urgency-done/90"
            >
              Sign off
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => decide("rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="flex flex-1 flex-col overflow-hidden">
        {/* Approval timeline = WO comments (where operators actually discuss). */}
        <TimelineFeed data={data} onMutated={onMutated} />
      </TabsContent>
    </Tabs>
  );
}

/* -------------------- Phase B memory blocks -------------------- */

/**
 * Tenant context — who's the human on the other end of the call. Renders
 * a single compact prose line. Skipped when no tenant lives at the unit.
 */
function TenantBlock({ tenant }: { tenant?: TenantContextC | null }) {
  if (!tenant) return null;
  const name = tenant.name ?? tenant.email ?? "tenant";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Tenant
      </div>
      <div className="mt-1 font-mono text-[11px] tabular-nums text-foreground/90">
        <span className="text-foreground">{name}</span>
        {tenant.unitTicketCount > 0 && (
          <span className="text-muted-foreground">
            {" "}
            · {tenant.unitTicketCount}{" "}
            {tenant.unitTicketCount === 1 ? "ticket" : "tickets"} at this unit
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Inspection lineage — when this WO was spawned from an inspection, surface
 * the inspection ref + open-findings count. Lets the operator jump back to
 * the parent walk-through.
 */
function InspectionLineageBlock({
  lineage,
}: {
  lineage?: InspectionLineageC | null;
}) {
  if (!lineage) return null;
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        From inspection
      </div>
      <div className="mt-1 font-mono text-[11px] tabular-nums text-foreground/90">
        <Link
          href={`?d=${lineage.ref}`}
          scroll={false}
          data-ref={lineage.ref}
          className="text-foreground hover:underline"
        >
          {lineage.ref}
        </Link>
        <span className="text-muted-foreground">
          {" "}
          · {lineage.kind.replace(/_/g, " ")} inspection
        </span>
        {lineage.openFindingsCount > 0 && (
          <span className="text-urgency-blocked">
            {" "}
            · {lineage.openFindingsCount}{" "}
            {lineage.openFindingsCount === 1 ? "finding" : "findings"} still open
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Dispatch dot-strip — last 6 status changes oldest → newest. Operator sees
 * the *shape* of the WO's life at a glance. Not a chart; just dots + verbs.
 */
function DispatchTimelineBlock({
  events,
}: {
  events?: DispatchEventC[];
}) {
  if (!events || events.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Dispatch
      </div>
      <ol className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] tabular-nums">
        {events.map((e, i) => {
          const tone =
            e.status === "blocked"
              ? "text-urgency-blocked"
              : e.status === "cancelled"
                ? "text-urgency-overdue"
                : e.status === "closed" || e.status === "verified"
                  ? "text-muted-foreground"
                  : "text-foreground/80";
          return (
            <li
              key={`${e.at}-${i}`}
              className="flex items-baseline gap-1"
            >
              <span
                className={cn(
                  "size-1.5 self-center rounded-full",
                  e.status === "blocked" && "bg-urgency-blocked",
                  e.status === "cancelled" && "bg-urgency-overdue",
                  e.status === "in_progress" && "bg-urgency-inflow",
                  e.status === "closed" && "bg-urgency-done",
                  e.status === "verified" && "bg-urgency-done",
                  !["blocked", "cancelled", "in_progress", "closed", "verified"].includes(
                    e.status,
                  ) && "bg-muted-foreground/60",
                )}
                aria-hidden
              />
              <span className={tone}>
                {workOrderStatusLabel(e.status)}
              </span>
              <TimeSince
                at={e.at}
                className="text-muted-foreground/70"
              />
              {i < events.length - 1 && (
                <span className="text-muted-foreground/40" aria-hidden>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* -------------------- shared bits -------------------- */

function statusUrgency(state: State): Urgency {
  if (state.kind !== "ready") return "muted";
  return statusUrgencyOf(state.data.status);
}

function statusUrgencyOf(s: string): Urgency {
  if (s === "blocked") return "blocked";
  if (s === "in_progress") return "inflow";
  if (s === "closed" || s === "verified" || s === "reviewed") return "done";
  if (s === "pending") return "blocked";
  return "muted";
}

function drawerTitle(data: EntityDetail): string {
  if (data.type === "approval" && data.reason) {
    return approvalReasonLabel(data.reason);
  }
  return data.title;
}

function diffNote(diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const d = diff as Record<string, unknown>;
  const to = d.to;
  if (typeof to === "string") return `→ ${to}`;
  if (to && typeof to === "object") {
    const obj = to as Record<string, unknown>;
    if (typeof obj.status === "string")
      return `→ ${workOrderStatusLabel(obj.status)}`;
  }
  return null;
}

function CostsList({ data }: { data: EntityDetail }) {
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

function FilesList({ data }: { data: EntityDetail }) {
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
    <div className="flex-1 space-y-3 px-4 py-3">
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  );
}

/** "4 days ago", "2 hours ago" — operator prose for time-since. */
function humanizeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h === 1) return "an hour ago";
  if (h < 24) return `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  const w = Math.round(d / 7);
  if (w < 8) return `${w} weeks ago`;
  const mo = Math.round(d / 30);
  return `${mo} months ago`;
}

/** Short date for the drawer properties panel: `May 13, 2:00p`. The full
 *  `.toLocaleString()` output reads like a developer dump; this is what an
 *  operator would write in a note. */
function compactDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(/\s/g, "");
  return `${date} · ${time}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}
