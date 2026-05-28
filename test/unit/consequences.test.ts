import { describe, expect, it } from "vitest";
import {
  consequenceChipLabel,
  consequenceForApproval,
  consequenceScore,
  type Consequence,
} from "@/lib/server/consequences";

const EMPTY: Consequence = {
  delaysTurn: false,
  tenantOccupied: false,
  lifeSafety: false,
  unblocksRef: null,
};

describe("consequenceForApproval", () => {
  it("packages the unblocks ref", () => {
    expect(consequenceForApproval("WO-1043")).toEqual({
      ...EMPTY,
      unblocksRef: "WO-1043",
    });
  });

  it("handles null woRef (orphan approval) without throwing", () => {
    expect(consequenceForApproval(null).unblocksRef).toBeNull();
  });
});

describe("consequenceScore", () => {
  it("returns 0 for empty / undefined consequence", () => {
    expect(consequenceScore(undefined)).toBe(0);
    expect(consequenceScore(EMPTY)).toBe(0);
  });

  it("weights life-safety highest, then delays-turn, then tenant, then unblocks", () => {
    expect(consequenceScore({ ...EMPTY, lifeSafety: true })).toBe(8);
    expect(consequenceScore({ ...EMPTY, delaysTurn: true })).toBe(4);
    expect(consequenceScore({ ...EMPTY, tenantOccupied: true })).toBe(2);
    expect(consequenceScore({ ...EMPTY, unblocksRef: "WO-1" })).toBe(1);
  });

  it("sums when multiple signals fire", () => {
    expect(
      consequenceScore({
        ...EMPTY,
        lifeSafety: true,
        delaysTurn: true,
        tenantOccupied: true,
      }),
    ).toBe(8 + 4 + 2);
  });
});

describe("consequenceChipLabel", () => {
  it("returns null when nothing fires", () => {
    expect(consequenceChipLabel(undefined)).toBeNull();
    expect(consequenceChipLabel(EMPTY)).toBeNull();
  });

  it("life-safety dominates every other signal", () => {
    const everything: Consequence = {
      delaysTurn: true,
      tenantOccupied: true,
      lifeSafety: true,
      unblocksRef: "WO-1",
    };
    expect(consequenceChipLabel(everything)).toBe("life safety");
  });

  it("delays-turn beats tenant + unblocks", () => {
    expect(
      consequenceChipLabel({
        ...EMPTY,
        delaysTurn: true,
        tenantOccupied: true,
        unblocksRef: "WO-1",
      }),
    ).toBe("delays turn");
  });

  it("unblocks beats tenant when nothing higher fires", () => {
    expect(
      consequenceChipLabel({ ...EMPTY, unblocksRef: "WO-99", tenantOccupied: true }),
    ).toBe("unblocks WO-99");
  });

  it("tenant alone surfaces as 'tenant'", () => {
    expect(consequenceChipLabel({ ...EMPTY, tenantOccupied: true })).toBe("tenant");
  });
});

describe("life-safety detector (via chip)", () => {
  // The detection regex lives in consequences.ts. We can't exercise the
  // DB-bound loadWoConsequences from a unit test, but we can confirm chip
  // wiring picks up the lifeSafety flag once it's set.
  it("surfaces 'life safety' chip when lifeSafety=true", () => {
    expect(consequenceChipLabel({ ...EMPTY, lifeSafety: true })).toBe("life safety");
  });
});
