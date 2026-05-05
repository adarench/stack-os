import { describe, expect, it } from "vitest";
import {
  WORK_ORDER_STATUSES,
  allowedNext,
  canTransition,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";

describe("work_orders state machine", () => {
  it("knows the canonical statuses", () => {
    expect(WORK_ORDER_STATUSES).toContain("new");
    expect(WORK_ORDER_STATUSES).toContain("closed");
    expect(WORK_ORDER_STATUSES).toContain("cancelled");
  });

  it("allows the happy path: new → triaged → assigned → scheduled → in_progress → resolved → verified → closed", () => {
    const path: WorkOrderStatus[] = [
      "new",
      "triaged",
      "assigned",
      "scheduled",
      "in_progress",
      "resolved",
      "verified",
      "closed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("rejects skipping triage", () => {
    expect(canTransition("new", "assigned")).toBe(false);
    expect(canTransition("new", "scheduled")).toBe(false);
  });

  it("does not allow leaving terminal states", () => {
    expect(allowedNext("closed")).toEqual([]);
    expect(allowedNext("cancelled")).toEqual([]);
    expect(canTransition("closed", "new")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
  });

  it("allows cancellation from non-terminal states", () => {
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("triaged", "cancelled")).toBe(true);
    expect(canTransition("in_progress", "cancelled")).toBe(true);
  });

  it("supports re-opening from resolved → in_progress (rework path)", () => {
    expect(canTransition("resolved", "in_progress")).toBe(true);
    expect(canTransition("verified", "in_progress")).toBe(true);
  });

  it("blocked is not terminal — can return to assigned/scheduled/in_progress", () => {
    expect(canTransition("blocked", "assigned")).toBe(true);
    expect(canTransition("blocked", "scheduled")).toBe(true);
    expect(canTransition("blocked", "in_progress")).toBe(true);
  });

  it("self-transitions are not allowed", () => {
    for (const s of WORK_ORDER_STATUSES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});
