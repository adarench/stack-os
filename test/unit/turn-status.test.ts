import { describe, expect, it } from "vitest";
import {
  computeTurn,
  type ApprovalGate,
  type TurnChild,
} from "@/lib/server/turn-status";

/**
 * Validates the turn model: given a turn's children + the approvals gating
 * them + a move-in date, does computeTurn correctly answer "on track?" and
 * "who must act on each blocker?".
 */

const NOW = new Date("2026-06-08T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const NO_APPROVALS = new Map<string, ApprovalGate>();

let seq = 0;
function child(
  status: string,
  dueAt: Date | null,
  owner: { name: string; kind: "vendor" | "user" } | null = null,
): TurnChild {
  seq += 1;
  return {
    id: `wo-${seq}`,
    ref: `WO-${1000 + seq}`,
    title: `task ${seq}`,
    status,
    dueAt,
    owner: owner?.name ?? null,
    ownerKind: owner?.kind ?? null,
  };
}

describe("computeTurn — turn-health model", () => {
  it("on_track: all work moving, move-in comfortably out", () => {
    const t = computeTurn(
      [child("closed", inDays(-2)), child("scheduled", inDays(4)), child("scheduled", inDays(5))],
      NO_APPROVALS,
      inDays(9),
      NOW,
    );
    expect(t.confidence).toBe("on_track");
    expect(t.urgency).toBe("muted");
    expect(t.done).toBe(1);
    expect(t.total).toBe(3);
    expect(t.daysToMoveIn).toBe(9);
    expect(t.blockers).toHaveLength(0);
  });

  it("on_track near move-in surfaces as 'today' urgency", () => {
    const t = computeTurn(
      [child("scheduled", inDays(2))],
      NO_APPROVALS,
      inDays(2),
      NOW,
    );
    expect(t.confidence).toBe("at_risk"); // ≤2 days out with open work
    const t2 = computeTurn([child("scheduled", inDays(3))], NO_APPROVALS, inDays(3), NOW);
    expect(t2.confidence).toBe("on_track");
    expect(t2.urgency).toBe("today");
  });

  it("at_risk: a blocked child with move-in still ahead", () => {
    const t = computeTurn(
      [child("blocked", inDays(4)), child("scheduled", inDays(5))],
      NO_APPROVALS,
      inDays(9),
      NOW,
    );
    expect(t.confidence).toBe("at_risk");
    expect(t.urgency).toBe("blocked");
    expect(t.blocked).toBe(1);
    expect(t.blockers[0]).toMatchObject({ reason: "blocked" });
  });

  it("at_risk: a child awaiting approval carries the sign-off action", () => {
    const c = child("blocked", inDays(3));
    const gates = new Map<string, ApprovalGate>([
      [c.id, { ref: "AP-ABC123", amountCents: "72000" }],
    ]);
    const t = computeTurn([c], gates, inDays(9), NOW);
    expect(t.confidence).toBe("at_risk");
    expect(t.pendingApprovals).toBe(1);
    // overdue dominates, but this isn't overdue — so reason is "awaiting approval"
    expect(t.blockers[0]).toMatchObject({
      ref: c.ref,
      reason: "awaiting approval",
      actorNeeded: "you",
      approvalRef: "AP-ABC123",
      amountCents: "72000",
    });
  });

  it("ownership: a vendor-owned blocker needs the vendor; carries owner name", () => {
    const c = child("blocked", inDays(4), { name: "Northstar GC", kind: "vendor" });
    const t = computeTurn([c], NO_APPROVALS, inDays(9), NOW);
    expect(t.blockers[0]).toMatchObject({
      owner: "Northstar GC",
      actorNeeded: "vendor",
      approvalRef: null,
    });
  });

  it("off_track: an overdue open child", () => {
    const t = computeTurn(
      [child("blocked", inDays(-1)), child("scheduled", inDays(5))],
      NO_APPROVALS,
      inDays(9),
      NOW,
    );
    expect(t.confidence).toBe("off_track");
    expect(t.urgency).toBe("overdue");
    expect(t.overdue).toBe(1);
    expect(t.blockers[0]).toMatchObject({ reason: "overdue" });
  });

  it("off_track: move-in date already passed with open work", () => {
    const t = computeTurn(
      [child("scheduled", inDays(2))],
      NO_APPROVALS,
      inDays(-1),
      NOW,
    );
    expect(t.confidence).toBe("off_track");
    expect(t.daysToMoveIn).toBe(-1);
  });

  it("counts: cancelled children excluded from total; all done → done urgency", () => {
    const t = computeTurn(
      [child("closed", inDays(-3)), child("verified", inDays(-2)), child("cancelled", inDays(-1))],
      NO_APPROVALS,
      inDays(5),
      NOW,
    );
    expect(t.total).toBe(2); // cancelled excluded
    expect(t.done).toBe(2);
    expect(t.open).toBe(0);
    expect(t.confidence).toBe("on_track");
    expect(t.urgency).toBe("done");
  });

  it("blockers sort worst-first: overdue before blocked", () => {
    const t = computeTurn(
      [child("blocked", inDays(5)), child("blocked", inDays(-1))],
      NO_APPROVALS,
      inDays(9),
      NOW,
    );
    expect(t.blockers[0]!.reason).toBe("overdue");
    expect(t.blockers[1]!.reason).toBe("blocked");
  });

  it("no target completion → daysToMoveIn null, still reads child state", () => {
    const t = computeTurn([child("blocked", null)], NO_APPROVALS, null, NOW);
    expect(t.daysToMoveIn).toBeNull();
    expect(t.confidence).toBe("at_risk");
  });
});
