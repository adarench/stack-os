import { describe, expect, it } from "vitest";
import { attentionBucket, groupByAttention } from "@/lib/attention-buckets";
import type { WorkRow } from "@/lib/server/work-list";
import {
  allowedNext,
  canTransition,
} from "@contracts/state-machines/inspection";

function row(p: Partial<WorkRow>): WorkRow {
  return {
    id: "x",
    ref: "WO-1",
    type: "wo",
    title: "t",
    status: "new",
    priority: "normal",
    ownerName: null,
    property: null,
    unit: null,
    unitId: null,
    dueAt: null,
    lastActionAt: "2026-01-01T00:00:00.000Z",
    lastActionText: null,
    urgency: "muted",
    aged: false,
    legacyHref: "",
    ...p,
  } as WorkRow;
}

describe("attentionBucket", () => {
  it("closed work orders land in 'done'", () => {
    expect(attentionBucket(row({ isOpen: false, acknowledgedAt: null }))).toBe("done");
  });

  it("open + never acknowledged is 'unseen'", () => {
    expect(attentionBucket(row({ isOpen: true, acknowledgedAt: null }))).toBe("unseen");
  });

  it("seen but tenant not updated is 'tenant'", () => {
    expect(
      attentionBucket(
        row({ isOpen: true, acknowledgedAt: "2026-01-02T00:00:00.000Z", tenantUpdatedAt: null }),
      ),
    ).toBe("tenant");
  });

  it("seen + tenant updated is 'inhand'", () => {
    expect(
      attentionBucket(
        row({
          isOpen: true,
          acknowledgedAt: "2026-01-02T00:00:00.000Z",
          tenantUpdatedAt: "2026-01-03T00:00:00.000Z",
        }),
      ),
    ).toBe("inhand");
  });
});

describe("groupByAttention", () => {
  it("groups rows, drops empty buckets, sorts oldest-first within a bucket", () => {
    const rows = [
      row({ ref: "WO-1", isOpen: true, acknowledgedAt: null, openedAt: "2026-01-05T00:00:00.000Z" }),
      row({ ref: "WO-2", isOpen: true, acknowledgedAt: null, openedAt: "2026-01-01T00:00:00.000Z" }),
      row({ ref: "WO-3", isOpen: false }),
    ];
    const groups = groupByAttention(rows);
    // Only 'unseen' and 'done' are non-empty → 'tenant' and 'inhand' are dropped.
    expect(groups.map((g) => g.key)).toEqual(["unseen", "done"]);
    const unseen = groups.find((g) => g.key === "unseen")!;
    // Oldest openedAt (WO-2) sorts ahead of WO-1.
    expect(unseen.items.map((r) => r.ref)).toEqual(["WO-2", "WO-1"]);
  });
});

describe("inspection state machine", () => {
  it("allowedNext matches the transition table", () => {
    expect(allowedNext("scheduled")).toEqual(["in_progress", "cancelled"]);
    expect(allowedNext("in_progress")).toEqual(["completed", "cancelled"]);
    expect(allowedNext("completed")).toEqual(["reviewed"]);
    expect(allowedNext("reviewed")).toEqual([]);
    expect(allowedNext("cancelled")).toEqual([]);
  });

  it("rejects skipping straight to completed/reviewed", () => {
    expect(canTransition("scheduled", "completed")).toBe(false);
    expect(canTransition("scheduled", "reviewed")).toBe(false);
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("completed", "reviewed")).toBe(true);
  });
});
