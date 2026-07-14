import { redirect } from "next/navigation";

/**
 * Stage A redirect. Compliance monitoring moved into the consolidated
 * Vendors & Compliance area at /vendors?tab=compliance. Removed next release.
 */
export default function ComplianceRedirect() {
  redirect("/vendors?tab=compliance");
}
