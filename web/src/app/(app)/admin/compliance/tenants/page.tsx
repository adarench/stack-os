import { redirect } from "next/navigation";

/**
 * Stage A redirect. Tenant insurance moved into the Vendors & Compliance
 * area at /vendors?tab=compliance. Removed next release.
 */
export default function AdminTenantInsuranceRedirect() {
  redirect("/vendors?tab=compliance");
}
