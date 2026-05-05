import { describe, expect, it } from "vitest";
import { searchPattern, parseWoNumber } from "@/lib/server/work-orders";

describe("work-order search / searchPattern", () => {
  it("returns null for empty/whitespace/undefined", () => {
    expect(searchPattern(null)).toBeNull();
    expect(searchPattern(undefined)).toBeNull();
    expect(searchPattern("")).toBeNull();
    expect(searchPattern("   ")).toBeNull();
  });

  it("wraps trimmed input in % wildcards", () => {
    expect(searchPattern("leak")).toBe("%leak%");
    expect(searchPattern("  leak  ")).toBe("%leak%");
  });

  it("escapes ILIKE metacharacters so user input cannot break the pattern", () => {
    expect(searchPattern("50%")).toBe("%50\\%%");
    expect(searchPattern("hot_water")).toBe("%hot\\_water%");
    expect(searchPattern("path\\to\\file")).toBe("%path\\\\to\\\\file%");
  });

  it("allows multi-word queries through (callers ILIKE on title/description)", () => {
    expect(searchPattern("hot water")).toBe("%hot water%");
  });
});

describe("work-order search / parseWoNumber", () => {
  it("parses WO-123 / wo-123 / WO123 / 123", () => {
    expect(parseWoNumber("WO-123")).toBe(123);
    expect(parseWoNumber("wo-7")).toBe(7);
    expect(parseWoNumber("WO45")).toBe(45);
    expect(parseWoNumber("9")).toBe(9);
    expect(parseWoNumber("  WO-1  ")).toBe(1);
  });

  it("returns null for non-numeric / mixed text", () => {
    expect(parseWoNumber("leak")).toBeNull();
    expect(parseWoNumber("WO-abc")).toBeNull();
    expect(parseWoNumber("123-456")).toBeNull();
    expect(parseWoNumber("")).toBeNull();
    expect(parseWoNumber(null)).toBeNull();
    expect(parseWoNumber(undefined)).toBeNull();
  });

  it("rejects zero and negatives (WO numbers are 1-indexed)", () => {
    expect(parseWoNumber("0")).toBeNull();
    expect(parseWoNumber("-1")).toBeNull();
  });
});
