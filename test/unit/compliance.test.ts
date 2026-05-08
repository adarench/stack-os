import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_STATUSES,
  COMPLIANCE_EXPIRING_WINDOW_DAYS,
  computeComplianceStatus,
} from "@/contracts/compliance";

describe("compliance / computeComplianceStatus", () => {
  const NOW = new Date("2026-05-08T12:00:00Z");

  it("active when expires far in the future", () => {
    const expiresAt = new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000);
    expect(computeComplianceStatus({ effectiveAt: null, expiresAt, now: NOW })).toBe("active");
  });

  it("expiring when within the warning window", () => {
    const expiresAt = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
    expect(computeComplianceStatus({ effectiveAt: null, expiresAt, now: NOW })).toBe("expiring");
  });

  it("expired when past expires_at", () => {
    const expiresAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(computeComplianceStatus({ effectiveAt: null, expiresAt, now: NOW })).toBe("expired");
  });

  it("active when no expiry is set", () => {
    expect(computeComplianceStatus({ effectiveAt: null, expiresAt: null, now: NOW })).toBe("active");
  });

  it("superseded overrides everything", () => {
    const expiresAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(
      computeComplianceStatus({
        effectiveAt: null,
        expiresAt,
        isSuperseded: true,
        now: NOW,
      }),
    ).toBe("superseded");
  });

  it("boundary at exactly the warning window", () => {
    const expiresAt = new Date(
      NOW.getTime() + COMPLIANCE_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(computeComplianceStatus({ effectiveAt: null, expiresAt, now: NOW })).toBe("expiring");
  });

  it("COMPLIANCE_STATUSES is the canonical set", () => {
    expect([...COMPLIANCE_STATUSES].sort()).toEqual([
      "active",
      "expired",
      "expiring",
      "superseded",
    ]);
  });
});
