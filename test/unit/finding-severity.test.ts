import { describe, expect, it } from "vitest";
import {
  FINDING_SEVERITIES,
  SPAWNABLE_SEVERITIES,
  shouldSpawnWorkOrder,
} from "@/contracts/finding-severity";

describe("finding severity / shouldSpawnWorkOrder", () => {
  it("never spawns when pass=true regardless of severity", () => {
    for (const s of FINDING_SEVERITIES) {
      expect(shouldSpawnWorkOrder({ severity: s, pass: true })).toBe(false);
    }
  });

  it("spawns only for actionable + critical when pass=false", () => {
    expect(shouldSpawnWorkOrder({ severity: "info", pass: false })).toBe(false);
    expect(shouldSpawnWorkOrder({ severity: "observation", pass: false })).toBe(false);
    expect(shouldSpawnWorkOrder({ severity: "actionable", pass: false })).toBe(true);
    expect(shouldSpawnWorkOrder({ severity: "critical", pass: false })).toBe(true);
  });

  it("SPAWNABLE_SEVERITIES is the canonical set", () => {
    expect([...SPAWNABLE_SEVERITIES].sort()).toEqual(["actionable", "critical"]);
  });
});
