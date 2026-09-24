import { describe, expect, it } from "vitest";
import {
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";
import {
  canMarkWaiting,
  completePath,
  techActions,
  techStatusLabel,
} from "@contracts/state-machines/work-order-tech-ux";

describe("tech WO UX (ops #20)", () => {
  it("labels blocked as Waiting and resolved as Complete", () => {
    expect(techStatusLabel("blocked")).toBe("Waiting");
    expect(techStatusLabel("resolved")).toBe("Complete");
    expect(techStatusLabel("in_progress")).toBe("In progress");
  });

  it("Complete from in_progress is a single hop to resolved", () => {
    expect(completePath("in_progress")).toEqual(["resolved"]);
  });

  it("Complete from assigned/scheduled/blocked chains through in_progress", () => {
    expect(completePath("assigned")).toEqual(["in_progress", "resolved"]);
    expect(completePath("scheduled")).toEqual(["in_progress", "resolved"]);
    expect(completePath("blocked")).toEqual(["in_progress", "resolved"]);
  });

  it("Complete is unavailable from office-only states", () => {
    expect(completePath("new")).toBeNull();
    expect(completePath("triaged")).toBeNull();
    expect(completePath("verified")).toBeNull();
    expect(completePath("closed")).toBeNull();
    expect(completePath("cancelled")).toBeNull();
    expect(completePath("resolved")).toBeNull();
  });

  it("Waiting only where blocked is a legal next state", () => {
    expect(canMarkWaiting("assigned")).toBe(true);
    expect(canMarkWaiting("scheduled")).toBe(true);
    expect(canMarkWaiting("in_progress")).toBe(true);
    expect(canMarkWaiting("blocked")).toBe(false);
    expect(canMarkWaiting("new")).toBe(false);
    expect(canMarkWaiting("resolved")).toBe(false);
  });

  it("techActions never expose Start Work / cancelled", () => {
    for (const status of WORK_ORDER_STATUSES) {
      const actions = techActions(status as WorkOrderStatus);
      for (const a of actions) {
        expect(["Complete", "Waiting"]).toContain(a.label);
        expect(a.path.length).toBeGreaterThan(0);
        expect(a.path).not.toContain("cancelled");
      }
    }
  });

  it("in_progress offers both Complete and Waiting", () => {
    expect(techActions("in_progress").map((a) => a.kind)).toEqual([
      "complete",
      "waiting",
    ]);
  });

  it("blocked offers Complete only (already Waiting)", () => {
    expect(techActions("blocked").map((a) => a.kind)).toEqual(["complete"]);
  });
});
