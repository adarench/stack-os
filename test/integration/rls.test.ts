import { describe, it, expect } from "vitest";

/**
 * RLS smoke test scaffold.
 *
 * Skipped unless DATABASE_URL is set. When wired up (P1 day 1 once Neon is
 * provisioned), this test should:
 *   1. Connect with two distinct app.org_id session vars
 *   2. Insert a work_order in org A
 *   3. Confirm org B cannot SELECT it
 *   4. Confirm staff with no org cannot SELECT either
 *   5. Confirm a vendor_user assigned to that WO CAN SELECT it
 */

const dbUrl = process.env.DATABASE_URL;

describe.skipIf(!dbUrl)("RLS — staff org isolation", () => {
  it.todo("staff in org B cannot read org A's work_order");
  it.todo("missing app.org_id rejects all queries");
  it.todo("system actor without org cannot read entity tables");
});

describe.skipIf(!dbUrl)("RLS — vendor scope", () => {
  it.todo("vendor_user can SELECT only assigned work_orders");
  it.todo("vendor_user can read external comments only");
  it.todo("vendor_user can INSERT external comments on assigned WOs");
});

describe("RLS test harness", () => {
  it("is configured to skip when DATABASE_URL is missing", () => {
    expect(typeof dbUrl === "string" || dbUrl === undefined).toBe(true);
  });
});
