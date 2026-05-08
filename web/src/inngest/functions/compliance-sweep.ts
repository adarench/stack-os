import { inngest } from "../client";
import { runCoiExpirySweep } from "@/lib/server/coi";
import { runTenantInsuranceExpirySweep } from "@/lib/server/tenant-insurance";

/**
 * Daily cron: scans vendor_cois and tenant_insurance_policies, transitions
 * status active → expiring (within 30 days of expires_at) → expired (past
 * expires_at). Idempotent.
 */
export const complianceSweep = inngest.createFunction(
  { id: "compliance-sweep" },
  { cron: "0 7 * * *" }, // 7am UTC daily — gives staff their morning view
  async ({ step }) => {
    const cois = await step.run("vendor-coi-sweep", () => runCoiExpirySweep());
    const tenants = await step.run("tenant-insurance-sweep", () =>
      runTenantInsuranceExpirySweep(),
    );
    return { cois, tenants };
  },
);
