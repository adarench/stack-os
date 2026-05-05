import { describe, expect, it } from "vitest";
import {
  DISPATCHER_STATUSES,
  countByStatus,
  isDispatcherTab,
  sortByPriorityThenAge,
  type DispatcherWorkOrder,
} from "@/lib/server/dispatcher";

const base: Partial<DispatcherWorkOrder> = {
  orgId: "org_x",
  number: 1,
  title: "x",
  description: null,
  kind: "work_order",
  propertyId: null,
  unitId: null,
  parentWorkOrderId: null,
  dueAt: null,
  scheduledFor: null,
  startedAt: null,
  completedAt: null,
  checkedInAt: null,
  checkInLat: null,
  checkInLng: null,
  createdByUserId: null,
  createdByActorType: "user",
  updatedAt: new Date(),
  deletedAt: null,
};

const make = (over: Partial<DispatcherWorkOrder>): DispatcherWorkOrder =>
  ({ ...base, ...over } as DispatcherWorkOrder);

describe("dispatcher / DISPATCHER_STATUSES", () => {
  it("covers exactly new + triaged + blocked", () => {
    expect([...DISPATCHER_STATUSES].sort()).toEqual(["blocked", "new", "triaged"]);
  });
});

describe("dispatcher / isDispatcherTab", () => {
  it("accepts canonical tabs and rejects everything else", () => {
    expect(isDispatcherTab("all")).toBe(true);
    expect(isDispatcherTab("new")).toBe(true);
    expect(isDispatcherTab("triaged")).toBe(true);
    expect(isDispatcherTab("blocked")).toBe(true);
    expect(isDispatcherTab("closed")).toBe(false);
    expect(isDispatcherTab("")).toBe(false);
    expect(isDispatcherTab(undefined)).toBe(false);
    expect(isDispatcherTab(7)).toBe(false);
  });
});

describe("dispatcher / sortByPriorityThenAge", () => {
  it("urgent floats above high above normal above low", () => {
    const rows: DispatcherWorkOrder[] = [
      make({ id: "n", priority: "normal", status: "new", createdAt: new Date("2026-05-01") }),
      make({ id: "u", priority: "urgent", status: "new", createdAt: new Date("2026-05-04") }),
      make({ id: "h", priority: "high", status: "new", createdAt: new Date("2026-05-02") }),
      make({ id: "l", priority: "low", status: "new", createdAt: new Date("2026-05-03") }),
    ];
    const sorted = sortByPriorityThenAge(rows);
    expect(sorted.map((r) => r.id)).toEqual(["u", "h", "n", "l"]);
  });

  it("within a priority, older WOs come first (FIFO)", () => {
    const rows: DispatcherWorkOrder[] = [
      make({ id: "newer", priority: "normal", status: "new", createdAt: new Date("2026-05-04") }),
      make({ id: "older", priority: "normal", status: "new", createdAt: new Date("2026-05-01") }),
      make({ id: "middle", priority: "normal", status: "new", createdAt: new Date("2026-05-02") }),
    ];
    const sorted = sortByPriorityThenAge(rows);
    expect(sorted.map((r) => r.id)).toEqual(["older", "middle", "newer"]);
  });

  it("does not mutate the input array", () => {
    const rows: DispatcherWorkOrder[] = [
      make({ id: "a", priority: "low", status: "new", createdAt: new Date("2026-05-01") }),
      make({ id: "b", priority: "urgent", status: "new", createdAt: new Date("2026-05-02") }),
    ];
    const before = rows.map((r) => r.id);
    sortByPriorityThenAge(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("dispatcher / countByStatus", () => {
  it("totals match", () => {
    const rows: DispatcherWorkOrder[] = [
      make({ id: "1", status: "new", priority: "normal", createdAt: new Date() }),
      make({ id: "2", status: "new", priority: "normal", createdAt: new Date() }),
      make({ id: "3", status: "triaged", priority: "normal", createdAt: new Date() }),
      make({ id: "4", status: "blocked", priority: "normal", createdAt: new Date() }),
    ];
    const c = countByStatus(rows);
    expect(c).toEqual({ all: 4, new: 2, triaged: 1, blocked: 1 });
  });

  it("ignores statuses outside the dispatcher set", () => {
    const rows: DispatcherWorkOrder[] = [
      make({ id: "1", status: "new", priority: "normal", createdAt: new Date() }),
      make({ id: "2", status: "in_progress", priority: "normal", createdAt: new Date() }),
    ];
    const c = countByStatus(rows);
    expect(c).toEqual({ all: 2, new: 1, triaged: 0, blocked: 0 });
  });
});
