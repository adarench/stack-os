import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/format";

const NOW = new Date("2026-05-05T12:00:00Z");

describe("relativeTime", () => {
  it("returns 'just now' for sub-minute deltas", () => {
    expect(relativeTime(new Date("2026-05-05T11:59:30Z"), NOW)).toBe("just now");
  });

  it("formats minutes / hours / days", () => {
    expect(relativeTime(new Date("2026-05-05T11:55:00Z"), NOW)).toBe("5m ago");
    expect(relativeTime(new Date("2026-05-05T09:00:00Z"), NOW)).toBe("3h ago");
    expect(relativeTime(new Date("2026-05-03T12:00:00Z"), NOW)).toBe("2d ago");
  });

  it("falls back to a date string for older entries", () => {
    const old = new Date("2026-01-01T00:00:00Z");
    const result = relativeTime(old, NOW);
    // Locale-formatted; just confirm it's not "Xd ago"
    expect(result).not.toMatch(/ago$/);
  });

  it("treats future dates as absolute date strings", () => {
    const tomorrow = new Date("2026-05-06T12:00:00Z");
    const result = relativeTime(tomorrow, NOW);
    expect(result).not.toMatch(/ago$/);
  });

  it("accepts date strings and timestamps", () => {
    expect(relativeTime("2026-05-05T11:59:30Z", NOW)).toBe("just now");
    expect(relativeTime(NOW.getTime() - 5 * 60_000, NOW)).toBe("5m ago");
  });
});
