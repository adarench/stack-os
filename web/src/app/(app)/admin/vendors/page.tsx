import { redirect } from "next/navigation";

/**
 * Stage A redirect. The vendor directory moved into the consolidated
 * Vendors & Compliance area at /vendors. Removed next release.
 */
export default function AdminVendorsRedirect() {
  redirect("/vendors");
}
