import { describe, expect, it } from "vitest";
import {
  bucket,
  laneBgTint,
  laneProjection,
  oldestRef,
  verbSummary,
  type ProjectionRow,
} from "@/lib/operator/lane-projection";

const row = (overrides: Partial<ProjectionRow> = {}): ProjectionRow => ({
  ref: "WO-1043",
  dueAt: null,
  lastActionAt: "2026-05-26T09:00:00Z",
  ...overrides,
});

describe("laneProjection", () => {
  it("OVERDUE pulses only the row whose ref matches oldestRef", () => {
    const oldest = laneProjection("overdue", row({ ref: "WO-1" }), "WO-1");
    const young = laneProjection("overdue", row({ ref: "WO-2" }), "WO-1");
    expect(oldest.barTone).toBe("red");
    expect(oldest.pulse).toBe(true);
    expect(young.barTone).toBe("red");
    expect(young.pulse).toBe(false);
  });

  it("BLOCKED uses amber bar and never pulses", () => {
    const p = laneProjection("blocked", row(), null);
    expect(p.barTone).toBe("amber");
    expect(p.pulse).toBe(false);
  });

  it("NEEDS YOU uses brand (indigo) bar — operator-personal pressure", () => {
    const p = laneProjection("needs", row(), null);
    expect(p.barTone).toBe("brand");
    expect(p.pulse).toBe(false);
  });

  it("IN-FLIGHT suppresses the severity bar — active work isn't urgency", () => {
    const p = laneProjection("inflight", row(), null);
    expect(p.suppressBar).toBe(true);
    expect(p.pulse).toBe(false);
  });

  it("JUST CHANGED is receded + no bar — ephemeral feel", () => {
    const p = laneProjection("changed", row(), null);
    expect(p.suppressBar).toBe(true);
    expect(p.receded).toBe(true);
  });

  it("TODAY anchors time on the left when dueAt is set", () => {
    const withTime = laneProjection("today", row({ dueAt: "2026-05-26T14:30:00Z" }), null);
    const noTime = laneProjection("today", row({ dueAt: null }), null);
    expect(withTime.timeAnchorLeft).toBe(true);
    expect(withTime.suppressBar).toBe(true);
    expect(noTime.timeAnchorLeft).toBe(false);
  });
});

describe("oldestRef", () => {
  const now = new Date("2026-05-26T10:00:00Z").getTime();

  it("returns null for empty list", () => {
    expect(oldestRef([], now)).toBeNull();
  });

  it("picks the row with the oldest dueAt anchor", () => {
    const result = oldestRef(
      [
        row({ ref: "A", dueAt: "2026-05-20T00:00:00Z" }),
        row({ ref: "B", dueAt: "2026-05-10T00:00:00Z" }), // oldest
        row({ ref: "C", dueAt: "2026-05-24T00:00:00Z" }),
      ],
      now,
    );
    expect(result).toBe("B");
  });

  it("falls back to lastActionAt when dueAt is null", () => {
    const result = oldestRef(
      [
        row({ ref: "A", dueAt: null, lastActionAt: "2026-05-22T00:00:00Z" }),
        row({ ref: "B", dueAt: null, lastActionAt: "2026-05-12T00:00:00Z" }), // oldest
      ],
      now,
    );
    expect(result).toBe("B");
  });
});

describe("laneBgTint", () => {
  it("uses red 5% opacity for OVERDUE — the loudest lane", () => {
    expect(laneBgTint("overdue")).toContain("urgency-overdue");
  });

  it("returns empty string for IN-FLIGHT and JUST CHANGED — no tint", () => {
    expect(laneBgTint("inflight")).toBe("");
    expect(laneBgTint("changed")).toBe("");
  });

  it("uses distinct tints per pressure-bearing lane", () => {
    expect(laneBgTint("blocked")).not.toBe(laneBgTint("overdue"));
    expect(laneBgTint("needs")).not.toBe(laneBgTint("overdue"));
    expect(laneBgTint("today")).not.toBe(laneBgTint("blocked"));
  });
});

describe("verbSummary", () => {
  it("returns null for empty list", () => {
    expect(verbSummary([])).toBeNull();
  });

  it("buckets and counts action verbs, sorted descending", () => {
    const result = verbSummary([
      { lastActionText: "resolved by Stark" },
      { lastActionText: "resolved by Garcia" },
      { lastActionText: "closed" },
      { lastActionText: "assigned to Stark" },
      { lastActionText: "blocked on parts" },
    ]);
    // 3 resolved, 1 assigned, 1 blocked
    expect(result).toMatch(/^3 resolved/);
    expect(result).toContain("1 assigned");
    expect(result).toContain("1 blocked");
  });

  it("caps the summary at 3 buckets", () => {
    const result = verbSummary([
      { lastActionText: "resolved" },
      { lastActionText: "assigned" },
      { lastActionText: "blocked" },
      { lastActionText: "comment added" },
      { lastActionText: "photo uploaded" },
    ]);
    expect(result?.split(" · ").length).toBeLessThanOrEqual(3);
  });
});

describe("bucket", () => {
  it("maps lifecycle verbs to 'resolved'", () => {
    expect(bucket("resolved by user")).toBe("resolved");
    expect(bucket("verified")).toBe("resolved");
    expect(bucket("closed")).toBe("resolved");
  });

  it("returns 'status' for unrecognized phrases — keeps the bucket honest", () => {
    expect(bucket("???")).toBe("status");
    expect(bucket("")).toBe("status");
  });
});
