import { describe, expect, it } from "vitest";
import { isValidCron, nextFireTime } from "@/lib/server/templates";

describe("cron / isValidCron", () => {
  it("accepts canonical 5-field expressions", () => {
    expect(isValidCron("0 9 * * 1")).toBe(true); // Mondays 9am
    expect(isValidCron("*/15 * * * *")).toBe(true); // every 15 min
    expect(isValidCron("0 0 1 * *")).toBe(true); // 1st of month
    expect(isValidCron("0 0 * * 0")).toBe(true); // Sundays midnight
  });

  it("rejects malformed expressions", () => {
    expect(isValidCron("")).toBe(false);
    expect(isValidCron("not a cron")).toBe(false);
    expect(isValidCron("60 * * * *")).toBe(false); // minute > 59
    expect(isValidCron("* 25 * * *")).toBe(false); // hour > 23
  });
});

describe("cron / nextFireTime", () => {
  it("computes the next Monday 9am ET correctly", () => {
    // 2026-05-08 is a Friday. Next Monday is 2026-05-11.
    const from = new Date("2026-05-08T12:00:00Z");
    const next = nextFireTime("0 9 * * 1", "America/New_York", from);
    expect(next.getUTCDate()).toBe(11);
    // 9am New_York = 13:00 UTC during DST
    expect(next.getUTCHours()).toBe(13);
  });

  it("returns the next occurrence even when called immediately after a fire", () => {
    const from = new Date("2026-05-11T13:00:00Z"); // Mon 9am ET exactly
    const next = nextFireTime("0 9 * * 1", "America/New_York", from);
    // Should advance to following Monday
    expect(next.getUTCDate()).toBe(18);
  });

  it("handles every-15-min cron", () => {
    const from = new Date("2026-05-08T12:07:00Z");
    const next = nextFireTime("*/15 * * * *", "UTC", from);
    expect(next.getUTCMinutes()).toBe(15);
  });
});
