import { describe, expect, it } from "vitest";
import {
  approvalLevelFor,
  canInvoiceTransition,
  COST_KINDS,
  INVOICE_STATUSES,
} from "@/contracts/financials";

describe("financials / approvalLevelFor", () => {
  it("auto-approves under $500", () => {
    expect(approvalLevelFor(0)).toBe("auto");
    expect(approvalLevelFor(50_000)).toBe("auto");
  });
  it("manager band $500–$5K", () => {
    expect(approvalLevelFor(50_001)).toBe("manager");
    expect(approvalLevelFor(500_000)).toBe("manager");
  });
  it("owner above $5K", () => {
    expect(approvalLevelFor(500_001)).toBe("owner");
    expect(approvalLevelFor(10_000_00)).toBe("owner");
  });
});

describe("financials / canInvoiceTransition", () => {
  it("happy path draft → submitted → approved → paid", () => {
    expect(canInvoiceTransition("draft", "submitted")).toBe(true);
    expect(canInvoiceTransition("submitted", "approved")).toBe(true);
    expect(canInvoiceTransition("approved", "paid")).toBe(true);
  });
  it("rejects skipping submission", () => {
    expect(canInvoiceTransition("draft", "approved")).toBe(false);
    expect(canInvoiceTransition("draft", "paid")).toBe(false);
  });
  it("void is terminal", () => {
    expect(canInvoiceTransition("void", "draft")).toBe(false);
    expect(canInvoiceTransition("void", "submitted")).toBe(false);
  });
  it("disputed loops back to submitted/approved/void", () => {
    expect(canInvoiceTransition("disputed", "submitted")).toBe(true);
    expect(canInvoiceTransition("disputed", "approved")).toBe(true);
    expect(canInvoiceTransition("disputed", "void")).toBe(true);
  });
});

describe("financials / canonical sets", () => {
  it("COST_KINDS", () => {
    expect([...COST_KINDS].sort()).toEqual(["fee", "labor", "materials", "other"]);
  });
  it("INVOICE_STATUSES", () => {
    expect(INVOICE_STATUSES).toContain("draft");
    expect(INVOICE_STATUSES).toContain("paid");
  });
});
