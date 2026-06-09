import { describe, expect, it } from "vitest";
import {
  selectComplianceBlockers,
  type ComplianceView,
} from "@/lib/server/compliance-view";

const NOW = new Date("2026-06-09T12:00:00Z");
const inDays = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

function view(partial: Partial<ComplianceView>): ComplianceView {
  return {
    cois: [],
    tenantIns: [],
    violations: [],
    summary: {
      coiActive: 0,
      coiExpiring: 0,
      coiExpired: 0,
      tenantActive: 0,
      tenantExpiring: 0,
      tenantExpired: 0,
      gateViolations: 0,
    },
    ...partial,
  };
}

const coi = (
  id: string,
  vendorId: string,
  vendorName: string,
  status: "active" | "expiring" | "expired",
  expiresAt: string | null,
  affectedOpenWoCount = 0,
) => ({
  id,
  vendorId,
  vendorName,
  policyNumber: null,
  carrier: null,
  expiresAt,
  status,
  updatedAt: NOW.toISOString(),
  affectedOpenWoCount,
});

describe("selectComplianceBlockers — /now morning-triage", () => {
  it("surfaces a no-COI violation as an alert with its blocked WOs", () => {
    const b = selectComplianceBlockers(
      view({
        violations: [
          {
            vendorId: "v1",
            vendorName: "Greenleaf",
            blockedOpenWoCount: 3,
            blockedWoRefs: [{ ref: "WO-1001", title: "x" }],
          },
        ],
      }),
      NOW,
    );
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ vendorName: "Greenleaf", reason: "no COI", tone: "alert", blockedCount: 3 });
    expect(b[0]!.blockedWoRefs).toHaveLength(1);
  });

  it("shows an expired COI with a date, alert tone", () => {
    const b = selectComplianceBlockers(
      view({ cois: [coi("c1", "v2", "Apex", "expired", inDays(-3), 2)] }),
      NOW,
    );
    expect(b[0]).toMatchObject({ vendorName: "Apex", reason: "COI expired", tone: "alert", detail: "expired 3d ago", blockedCount: 2 });
  });

  it("shows expiring-soon as warn, below alerts", () => {
    const b = selectComplianceBlockers(
      view({
        violations: [{ vendorId: "v1", vendorName: "Greenleaf", blockedOpenWoCount: 1, blockedWoRefs: [] }],
        cois: [coi("c2", "v3", "Volt", "expiring", inDays(8), 0)],
      }),
      NOW,
    );
    expect(b[0]!.tone).toBe("alert"); // violation first
    expect(b[1]).toMatchObject({ vendorName: "Volt", reason: "COI expiring", tone: "warn", detail: "in 8d" });
  });

  it("dedupes: a vendor with an expired COI is NOT also listed as 'no COI'", () => {
    const b = selectComplianceBlockers(
      view({
        violations: [{ vendorId: "v2", vendorName: "Apex", blockedOpenWoCount: 2, blockedWoRefs: [] }],
        cois: [coi("c1", "v2", "Apex", "expired", inDays(-1), 2)],
      }),
      NOW,
    );
    expect(b).toHaveLength(1);
    expect(b[0]!.reason).toBe("COI expired");
  });

  it("ranks alerts by how much work they block", () => {
    const b = selectComplianceBlockers(
      view({
        violations: [
          { vendorId: "a", vendorName: "Low", blockedOpenWoCount: 1, blockedWoRefs: [] },
          { vendorId: "b", vendorName: "High", blockedOpenWoCount: 5, blockedWoRefs: [] },
        ],
      }),
      NOW,
    );
    expect(b.map((x) => x.vendorName)).toEqual(["High", "Low"]);
  });

  it("empty compliance view → no blockers", () => {
    expect(selectComplianceBlockers(view({}), NOW)).toHaveLength(0);
  });
});
