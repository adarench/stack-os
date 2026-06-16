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

  it("matches Needs attention for attention=1", () => {
    expect(activeViewFor({ type: "wo", attention: "1" })).toBe("attention");
  });

  it("matches Tenant waiting for tenant=not_updated", () => {
    expect(activeViewFor({ type: "wo", tenant: "not_updated" })).toBe("tenant");
  });

  it("matches Aging for aging=1", () => {
    expect(activeViewFor({ type: "wo", aging: "1" })).toBe("aging");
  });

  it("matches Waiting for status=blocked", () => {
    expect(activeViewFor({ type: "wo", status: "blocked" })).toBe("waiting");
  });

  it("matches Moves for type=prj", () => {
    expect(activeViewFor({ type: "prj", status: "open" })).toBe("turns");
  });

  it("returns null when a param mismatches every view (custom filter)", () => {
    expect(activeViewFor({ type: "ins" })).toBeNull();
  });

  it("prefers the most-specific match — Aging beats All on more matched params", () => {
    // type+aging matches Aging (2); All needs status=open which is absent here.
    expect(activeViewFor({ type: "wo", aging: "1" })).toBe("aging");
  });

  it("every BUILTIN_VIEW has a non-empty params record", () => {
    for (const view of BUILTIN_VIEWS) {
      expect(Object.keys(view.params).length).toBeGreaterThan(0);
    }
  });
});
