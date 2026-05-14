import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auditLog } from "@db/schema/audit-log";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { users } from "@db/schema/users";
import { withStaffScope, type ScopedDB } from "./db";

export interface ActivityEvent {
  id: string;
  at: string;
  /** Audit action verb — `assigned`, `status_changed`, `comment_added`, ... */
  action: string;
  /** Resolved actor display name. `system`, `inngest`, or a staff initial like `AR`. */
  actor: string;
  actorType: string;
  /** Polymorphic target type as stored. */
  targetType: string;
  targetId: string;
  /** Human ref the dispatcher recognizes — `WO-1043`, `INS-AB12CD`, `PRJ-...`.
   *  Null when the target is a type not surfaced in the feed (vendor, COI, ...). */
  targetRef: string | null;
  /** Optional one-word state change extracted from the diff, when present.
   *  E.g. `→ resolved` for a status change. */
  diffNote: string | null;
}

const FEED_LIMIT = 12;

/**
 * Org-wide recent activity from the audit log, enriched with human refs and
 * actor names. Powers the activity strip on /now. Calm, dense, terminal-tape
 * feel — no avatars, no chrome.
 */
export async function loadRecentActivity(
  limit = FEED_LIMIT,
): Promise<ActivityEvent[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        actorType: auditLog.actorType,
        actorUserId: auditLog.actorUserId,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        diff: auditLog.diff,
        at: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.orgId, ctx.orgId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    const [refs, actors] = await Promise.all([
      resolveRefs(tx, ctx.orgId, rows),
      resolveActors(tx, ctx.orgId, rows),
    ]);

    return rows.map((r): ActivityEvent => ({
      id: r.id,
      at: r.at.toISOString(),
      action: r.action,
      actor: r.actorUserId
        ? actors.get(r.actorUserId) ?? "—"
        : actorLabel(r.actorType),
      actorType: r.actorType,
      targetType: r.targetType,
      targetId: r.targetId,
      targetRef: refs.get(`${r.targetType}:${r.targetId}`) ?? null,
      diffNote: extractDiffNote(r.action, r.diff),
    }));
  });
}

function actorLabel(actorType: string): string {
  if (actorType === "system") return "system";
  if (actorType === "inngest") return "inngest";
  if (actorType === "vendor") return "vendor";
  return "—";
}

/**
 * Pull a single salient word from a status_changed diff so the dispatcher
 * reads "→ resolved" not just "status_changed". For other actions, the verb
 * alone usually carries the meaning.
 */
function extractDiffNote(action: string, diff: unknown): string | null {
  if (action !== "status_changed" || !diff || typeof diff !== "object") {
    return null;
  }
  const d = diff as Record<string, unknown>;
  const to = d.to;
  if (typeof to === "string") return `→ ${to}`;
  if (to && typeof to === "object") {
    const obj = to as Record<string, unknown>;
    if (typeof obj.status === "string") return `→ ${obj.status}`;
  }
  return null;
}

async function resolveRefs(
  tx: ScopedDB,
  orgId: string,
  rows: Array<{ targetType: string; targetId: string }>,
): Promise<Map<string, string>> {
  const byType: Record<string, string[]> = {};
  for (const r of rows) {
    (byType[r.targetType] ||= []).push(r.targetId);
  }
  const out = new Map<string, string>();

  if (byType.work_order?.length) {
    const woRows = await tx
      .select({ id: workOrders.id, number: workOrders.number })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, orgId),
          inArray(workOrders.id, byType.work_order),
        ),
      );
    for (const w of woRows) {
      out.set(`work_order:${w.id}`, `WO-${w.number}`);
    }
  }

  if (byType.inspection?.length) {
    const insRows = await tx
      .select({ id: inspections.id })
      .from(inspections)
      .where(
        and(
          eq(inspections.orgId, orgId),
          inArray(inspections.id, byType.inspection),
        ),
      );
    for (const i of insRows) {
      out.set(`inspection:${i.id}`, `INS-${i.id.slice(0, 6).toUpperCase()}`);
    }
  }

  if (byType.project?.length) {
    const prjRows = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.orgId, orgId), inArray(projects.id, byType.project)),
      );
    for (const p of prjRows) {
      out.set(`project:${p.id}`, `PRJ-${p.id.slice(0, 6).toUpperCase()}`);
    }
  }

  return out;
}

async function resolveActors(
  tx: ScopedDB,
  orgId: string,
  rows: Array<{ actorUserId: string | null }>,
): Promise<Map<string, string>> {
  const ids = rows
    .map((r) => r.actorUserId)
    .filter((v): v is string => !!v);
  if (ids.length === 0) return new Map();
  const userRows = await tx
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.orgId, orgId), inArray(users.id, ids)));
  const out = new Map<string, string>();
  for (const u of userRows) {
    out.set(u.id, displayName(u.name, u.email));
  }
  return out;
}

function displayName(name: string | null, email: string): string {
  if (name && name.trim()) {
    const initials = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
    return initials || name;
  }
  // Fallback: first letters of email local part.
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "—";
}
