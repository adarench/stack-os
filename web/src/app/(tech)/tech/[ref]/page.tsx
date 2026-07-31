import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTechnicianWorkOrder } from "@/lib/server/technician";
import { parseWoNumber } from "@/lib/server/work-orders";
import { StatusChip, location } from "../_ui";
import {
  ackAction,
  startAction,
  blockAction,
  completeAction,
  replyAction,
  noteAction,
} from "../_actions";
import { TechPhotoUpload } from "./_photo-upload";

export const dynamic = "force-dynamic";

const BTN =
  "flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition-colors active:bg-muted";
const BTN_PRIMARY =
  "flex h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background shadow-sm transition-colors active:bg-foreground/90";

export default async function TechDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const wo = await loadTechnicianWorkOrder(ref);
  if (!wo) {
    // Not assigned to the caller (an admin, another tech, or a reassigned job
    // following the deep link) — open the full console drawer any staff member
    // can see (LR-014) instead of a hard 404. An unparseable ref → the queue.
    const num = parseWoNumber(ref);
    redirect(num !== null ? `/work?d=WO-${num}` : "/tech");
  }
  const can = (s: string) => wo.nextStatuses.includes(s);

  return (
    <div className="space-y-4">
      <Link href="/tech" className="inline-block text-xs text-muted-foreground">
        ← All work
      </Link>

      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">{wo.ref}</span>
          <StatusChip status={wo.status} />
        </div>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{wo.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {location([
            wo.property,
            wo.floor ? `Floor ${wo.floor}` : null,
            wo.suite ? `Suite ${wo.suite}` : wo.unit,
            wo.category,
          ])}
        </p>
      </div>

      {wo.requester && (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested by</p>
          <p className="text-sm font-medium">{wo.requester}</p>
          {wo.requesterEmail && (
            <p className="text-xs text-muted-foreground">{wo.requesterEmail}</p>
          )}
        </div>
      )}

      {wo.description && (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="whitespace-pre-wrap text-sm">{wo.description}</p>
        </div>
      )}

      {wo.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {wo.photos.map((p, i) =>
            p.isVideo ? (
              <video key={i} src={p.url} controls className="aspect-square w-full rounded-md object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.url} alt="" className="aspect-square w-full rounded-md object-cover" />
            ),
          )}
        </div>
      )}

      {/* Field actions */}
      <div className="flex flex-wrap gap-2">
        {!wo.acknowledged && (
          <form action={ackAction}>
            <input type="hidden" name="ref" value={wo.ref} />
            <button type="submit" className={BTN}>Acknowledge</button>
          </form>
        )}
        {can("in_progress") && (
          <form action={startAction}>
            <input type="hidden" name="ref" value={wo.ref} />
            <button type="submit" className={BTN}>Start work</button>
          </form>
        )}
        {can("blocked") && (
          <form action={blockAction}>
            <input type="hidden" name="ref" value={wo.ref} />
            <button type="submit" className={BTN}>Block</button>
          </form>
        )}
        {can("resolved") && (
          <form action={completeAction}>
            <input type="hidden" name="ref" value={wo.ref} />
            <button type="submit" className={BTN_PRIMARY}>Mark complete</button>
          </form>
        )}
        <TechPhotoUpload woRef={wo.ref} />
      </div>

      {/* Thread */}
      {wo.messages.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Messages</p>
          {wo.messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-background p-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.actorType === "tenant" ? "requester" : m.actorType}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    m.visibility === "external" ? "text-urgency-inflow" : "text-muted-foreground"
                  }`}
                >
                  {m.visibility === "external" ? "requester-visible" : "internal"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply to requester */}
      <form action={replyAction} className="space-y-2">
        <input type="hidden" name="ref" value={wo.ref} />
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Reply to the requester…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button type="submit" className={BTN}>Send to requester</button>
      </form>

      {/* Internal note */}
      <form action={noteAction} className="space-y-2">
        <input type="hidden" name="ref" value={wo.ref} />
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Internal note (team only)…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button type="submit" className={BTN}>Add internal note</button>
      </form>
    </div>
  );
}
