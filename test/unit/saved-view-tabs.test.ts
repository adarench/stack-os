import { describe, expect, it } from "vitest";
import {
  BUILTIN_VIEWS,
  activeViewFor,
} from "@/components/operator/saved-view-tabs";

describe("activeViewFor", () => {
  it("matches the All view on minimal default params", () => {
    expect(activeViewFor({ type: "wo", status: "open" })).toBe("all");
  });

  it("matches Mine when mine=mine present", () => {
    expect(activeViewFor({ type: "wo", mine: "mine" })).toBe("mine");
  });

  it("matches Mine-overdue when both mine=mine + due=overdue present", () => {
    expect(
      activeViewFor({ type: "wo", mine: "mine", due: "overdue" }),
    ).toBe("mine-overdue");
  });

  it("matches Unassigned for mine=unassigned", () => {
    expect(activeViewFor({ type: "wo", mine: "unassigned" })).toBe(
      "unassigned",
    );
  });

  it("matches Backlog when backlog=open is set", () => {
    expect(
      activeViewFor({ type: "wo", status: "open", backlog: "open" }),
    ).toBe("backlog");
  });

  it("returns null when a param mismatches every view (custom filter)", () => {
    expect(activeViewFor({ type: "ins" })).toBeNull();
  });

  it("prefers the most-specific match — Mine-overdue beats Mine on more matched params", () => {
    expect(
      activeViewFor({ type: "wo", mine: "mine", due: "overdue" }),
    ).toBe("mine-overdue");
  });

  it("every BUILTIN_VIEW has a non-empty params record", () => {
    for (const view of BUILTIN_VIEWS) {
      expect(Object.keys(view.params).length).toBeGreaterThan(0);
    }
  });
});
