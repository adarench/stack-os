import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { approvals } from "@db/schema/approvals";
import { assignments } from "@db/schema/assignments";
import { users } from "@db/schema/users";
import { vendors } from "@db/schema/vendors";
import { vendorUsers } from "@db/schema/vendor-users";
import type { ScopedDB } from "./db";
import type { Urgency } from "../../components/operator/urgency-dot";

/**
 * Turn status — derived, never stored. Answers the one question the product
 * couldn't before: "is this turn on track for its move-in date?" — and, for
 * the control surface, "who owns each blocker and what's the one action?"
 *
 * The computation is a PURE function (computeTurn) so the turn model can be
 * unit-tested without a database. The loader gathers the inputs (children +
 * their owners + the approvals gating them).
 *
 * Scope discipline: turn-only. No portfolio/lease readiness, no predicates.
 */

export interface TurnChild {
  id: string;
  ref: string;
  title: string;
  status: string;
  dueAt: Date | null;
  owner: string | null;
  ownerKind: "vendor" | "user" | null;
}

/** A pending approval gating a child WO. */
export interface ApprovalGate {
  ref: string;
  amountCents: string | null;
}

export interface TurnBlocker {
  ref: string;
  title: string;
  /** "overdue" | "awaiting approval" | "blocked". */
  reason: string;
  owner: string | null;
  /** Who has to move next: the operator ("you") or the assigned vendor. */
  actorNeeded: "you" | "vendor";
  /** When awaiting approval, the approval ref + amount for a one-click sign-off. */
  approvalRef: string | null;
  amountCents: string | null;
}

export interface TurnComputed {
  total: number;
  done: number;
  open: number;
  blocked: number;
  overdue: number;
  pendingApprovals: number;
  daysToMoveIn: number | null;
  confidence: "on_track" | "at_risk" | "off_track";
  urgency: Urgency;
  blockers: TurnBlocker[];
}

const DONE_STATUSES = new Set(["resolved", "verified", "closed"]);
const DEAD_STATUSES = new Set(["cancelled"]);
const DAY_MS = 86_400_000;
const REASON_RANK: Record<string, number> = {
  overdue: 0,
  "awaiting approval": 1,
  blocked: 2,
};

/**
 * Pure turn-health computation. Given a turn's children, the approvals gating
 * them (keyed by child WO id), and the move-in date, decide whether the turn
 * is on track — and surface what's holding it back + who must act.
 */
export function computeTurn(
  children: TurnChild[],
  approvalGates: Map<string, ApprovalGate>,
  targetCompletion: Date | null,
  now: Date,
): TurnComputed {
  let done = 0;
  let open = 0;
  let blocked = 0;
  let overdue = 0;
  let pendingApprovals = 0;
  const blockers: TurnBlocker[] = [];

  for (const c of children) {
    if (DEAD_STATUSES.has(c.status)) continue;
    if (DONE_STATUSES.has(c.status)) {
      done += 1;
      continue;
    }
    open += 1;
    const isBlocked = c.status === "blocked";
    const isOverdue = c.dueAt != null && c.dueAt < now;
    const gate = approvalGates.get(c.id);
    const awaitingApproval = gate != null;
    if (isBlocked) blocked += 1;
    if (isOverdue) overdue += 1;
    if (awaitingApproval) pendingApprovals += 1;
    if (isOverdue || awaitingApproval || isBlocked) {
      const reason = isOverdue
        ? "overdue"
        : awaitingApproval
          ? "awaiting approval"
          : "blocked";
      blockers.push({
        ref: c.ref,
        title: c.title,
        reason,
        owner: c.owner,
        // Approvals are the operator's to clear; vendor work is the vendor's
        // until the operator reassigns/escalates.
        actorNeeded: awaitingApproval
          ? "you"
          : c.ownerKind === "vendor"
            ? "vendor"
            : "you",
        approvalRef: gate?.ref ?? null,
        amountCents: gate?.amountCents ?? null,
      });
    }
  }

  const total = done + open;
  const daysToMoveIn =
    targetCompletion != null
      ? Math.ceil((targetCompletion.getTime() - now.getTime()) / DAY_MS)
      : null;
  const pastMoveIn = targetCompletion != null && targetCompletion < now;

  let confidence: TurnComputed["confidence"];
  if (overdue > 0 || (pastMoveIn && open > 0)) {
    confidence = "off_track";
  } else if (
    blocked > 0 ||
    pendingApprovals > 0 ||
    (daysToMoveIn != null && daysToMoveIn <= 2 && open > 0)
  ) {
    confidence = "at_risk";
  } else {
    confidence = "on_track";
  }

  let urgency: Urgency;
  if (confidence === "off_track") {
    urgency = "overdue";
  } else if (confidence === "at_risk") {
    urgency = "blocked";
  } else if (daysToMoveIn != null && daysToMoveIn <= 3 && open > 0) {
    urgency = "today";
  } else {
    urgency = open === 0 ? "done" : "muted";
  }

  blockers.sort(
    (a, b) => (REASON_RANK[a.reason] ?? 9) - (REASON_RANK[b.reason] ?? 9),
  );

  return {
    total,
    done,
    open,
    blocked,
    overdue,
    pendingApprovals,
    daysToMoveIn,
    confidence,
    urgency,
    blockers: blockers.slice(0, 6),
  };
}

/**
 * Batch-load turn status for a set of unit_turn projects: one query for the
 * children, one for their owners, one for the approvals gating them.
 */
export async function loadTurnStatuses(
  tx: ScopedDB,
  orgId: string,
  turns: Array<{ id: string; targetCompletion: Date | null }>,
  now: Date = new Date(),
): Promise<Map<string, TurnComputed>> {
  const out = new Map<string, TurnComputed>();
  if (turns.length === 0) return out;

  const ids = turns.map((t) => t.id);
  const kids = await tx
    .select({
      id: workOrders.id,
      number: workOrders.number,
      title: workOrders.title,
      status: workOrders.status,
      dueAt: workOrders.dueAt,
      projectId: workOrders.projectId,
    })
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), inArray(workOrders.projectId, ids)));

  const childIds = kids.map((k) => k.id);
  const [owners, gates] = await Promise.all([
    loadChildOwners(tx, orgId, childIds),
    loadApprovalGates(tx, orgId, childIds),
  ]);

  const byProject = new Map<string, TurnChild[]>();
  for (const k of kids) {
    if (!k.projectId) continue;
    const owner = owners.get(k.id) ?? null;
    const arr = byProject.get(k.projectId) ?? [];
    arr.push({
      id: k.id,
      ref: `WO-${k.number}`,
      title: k.title,
      status: k.status,
      dueAt: k.dueAt,
      owner: owner?.name ?? null,
      ownerKind: owner?.kind ?? null,
    });
    byProject.set(k.projectId, arr);
  }

  for (const t of turns) {
    out.set(
      t.id,
      computeTurn(byProject.get(t.id) ?? [], gates, t.targetCompletion, now),
    );
  }
  return out;
}

/** Active assignee per child WO, with kind (vendor vs staff) for "who acts". */
async function loadChildOwners(
  tx: ScopedDB,
  orgId: string,
  woIds: string[],
): Promise<Map<string, { name: string; kind: "vendor" | "user" }>> {
  const out = new Map<string, { name: string; kind: "vendor" | "user" }>();
  if (woIds.length === 0) return out;
  const rows = await tx
    .select({
      targetId: assignments.targetId,
      assigneeType: assignments.assigneeType,
      userName: users.name,
      userEmail: users.email,
      vendorName: vendors.name,
      vuName: vendorUsers.name,
      vuEmail: vendorUsers.email,
    })
    .from(assignments)
    .leftJoin(
      users,
      and(eq(users.id, assignments.assigneeId), eq(assignments.assigneeType, "user")),
    )
    .leftJoin(
      vendors,
      and(eq(vendors.id, assignments.assigneeId), eq(assignments.assigneeType, "vendor")),
    )
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        inArray(assignments.targetId, woIds),
        isNull(assignments.unassignedAt),
      ),
    )
    .orderBy(desc(assignments.assignedAt));
  for (const r of rows) {
    if (out.has(r.targetId)) continue;
    const kind: "vendor" | "user" = r.assigneeType === "user" ? "user" : "vendor";
    const name =
      r.userName ?? r.vendorName ?? r.vuName ?? r.userEmail ?? r.vuEmail ?? null;
    if (name) out.set(r.targetId, { name, kind });
  }
  return out;
}

/** Pending approvals gating child WOs, keyed by child WO id. */
async function loadApprovalGates(
  tx: ScopedDB,
  orgId: string,
  woIds: string[],
): Promise<Map<string, ApprovalGate>> {
  const out = new Map<string, ApprovalGate>();
  if (woIds.length === 0) return out;
  const rows = await tx
    .select({
      id: approvals.id,
      targetId: approvals.targetId,
      amountCents: approvals.amountCents,
    })
    .from(approvals)
    .where(
      and(
        eq(approvals.orgId, orgId),
        eq(approvals.targetType, "work_order"),
        eq(approvals.status, "pending"),
        inArray(approvals.targetId, woIds),
      ),
    );
  for (const r of rows) {
    if (out.has(r.targetId)) continue;
    out.set(r.targetId, {
      ref: `AP-${r.id.slice(0, 6).toUpperCase()}`,
      amountCents: r.amountCents,
    });
  }
  return out;
}
