import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_COLUMNS,
  ARCHIVED_BOARD_COLUMNS,
  groupByStatus,
  isBoardPriority,
  emptyBoard,
  type BoardWorkOrder,
} from "@/lib/server/board";
import { canTransition } from "@contracts/state-machines/work-order";

const fixture: Partial<BoardWorkOrder> & {
  id: string;
  status: BoardWorkOrder["status"];
} = {
  id: "00000000-0000-0000-0000-000000000001",
  orgId: "org_x",
  number: 1,
  title: "leak",
  status: "new",
  priority: "normal",
  kind: "work_order",
  description: null,
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
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const make = (over: Partial<BoardWorkOrder>): BoardWorkOrder =>
  ({ ...fixture, ...over } as BoardWorkOrder);

describe("board / groupByStatus", () => {
  it("returns one bucket per status", () => {
    const out = emptyBoard();
    expect(Object.keys(out).length).toBeGreaterThanOrEqual(8);
    for (const s of DEFAULT_BOARD_COLUMNS) {
      expect(out[s]).toEqual([]);
    }
  });

  it("places rows into their status bucket", () => {
    const rows = [
      make({ id: "a", status: "new" }),
      make({ id: "b", status: "in_progress" }),
      make({ id: "c", status: "new" }),
    ];
    const out = groupByStatus(rows);
    expect(out.new.map((w) => w.id)).toEqual(["a", "c"]);
    expect(out.in_progress.map((w) => w.id)).toEqual(["b"]);
    expect(out.closed).toEqual([]);
  });

  it("DEFAULT and ARCHIVED columns do not overlap", () => {
    const archived = new Set(ARCHIVED_BOARD_COLUMNS);
    for (const s of DEFAULT_BOARD_COLUMNS) {
      expect(archived.has(s)).toBe(false);
    }
  });
});

describe("board / drop validation", () => {
  it("the column adjacency model matches the state machine", () => {
    // Spot check: the kanban allows drag from new → triaged but not new → closed
    expect(canTransition("new", "triaged")).toBe(true);
    expect(canTransition("new", "closed")).toBe(false);
    // resolved is reachable from in_progress (drag right)
    expect(canTransition("in_progress", "resolved")).toBe(true);
    // and rework allows resolved → in_progress (drag left)
    expect(canTransition("resolved", "in_progress")).toBe(true);
  });
});

describe("board / isBoardPriority", () => {
  it("accepts only canonical priorities", () => {
    expect(isBoardPriority("urgent")).toBe(true);
    expect(isBoardPriority("normal")).toBe(true);
    expect(isBoardPriority("nope")).toBe(false);
    expect(isBoardPriority(undefined)).toBe(false);
    expect(isBoardPriority(42)).toBe(false);
  });
});
