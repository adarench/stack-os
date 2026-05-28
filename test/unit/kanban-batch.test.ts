import { describe, expect, it } from "vitest";
import {
  WORK_ORDER_STATUSES,
  allowedNext,
  canTransition,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";

/**
 * Mirror of the intersection logic in
 * web/src/components/board/kanban-board.tsx — kept inline so the unit
 * test never imports the client component (vitest can't compile React
 * client code with `"use client"` directives).
 */
function intersectionTargets(
  selectedStatuses: WorkOrderStatus[],
): WorkOrderStatus[] {
  let candidates: Set<WorkOrderStatus> | null = null;
  for (const from of selectedStatuses) {
    const allowed = new Set(allowedNext(from));
    if (candidates === null) candidates = allowed;
    else {
      for (const t of Array.from(candidates)) {
        if (!allowed.has(t)) candidates.delete(t);
      }
    }
  }
  return candidates ? Array.from(candidates) : [];
}

describe("kanban batch — intersection of allowed targets", () => {
  it("returns no targets for an empty selection", () => {
    expect(intersectionTargets([])).toEqual([]);
  });

  it("returns the lane's own next-set for a homogeneous selection", () => {
    const targets = intersectionTargets(["triaged", "triaged", "triaged"]);
    const expected = allowedNext("triaged");
    expect(new Set(targets)).toEqual(new Set(expected));
  });

  it("returns only the intersection across mixed lanes", () => {
    // 'new' allows next: ['triaged', 'cancelled']
    // 'triaged' allows: ['assigned', 'blocked', 'cancelled']
    // Intersection across {new, triaged}: ['cancelled']
    const targets = intersectionTargets(["new", "triaged"]);
    expect(targets).toEqual(["cancelled"]);
  });

  it("returns empty when no common next exists", () => {
    // 'closed' is terminal (allowedNext = []) — picking any other lane
    // alongside closed should yield an empty intersection.
    const targets = intersectionTargets(["assigned", "closed"]);
    expect(targets).toEqual([]);
  });
});

describe("kanban batch — per-card validity safety net", () => {
  it("rejects every transition out of a terminal status", () => {
    expect(canTransition("closed", "new")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
  });

  it("never allows a transition that skips a state machine step", () => {
    // 'new' -> 'in_progress' must require triage + assignment first.
    expect(canTransition("new", "in_progress")).toBe(false);
  });

  it("every status has a deterministic allowedNext set", () => {
    for (const s of WORK_ORDER_STATUSES) {
      const next = allowedNext(s);
      // No self-loops: a status can never transition to itself.
      expect(next).not.toContain(s);
    }
  });
});
