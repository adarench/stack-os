import { redirect } from "next/navigation";

/**
 * Stage A redirect. Vendor COIs are now co-located in the Vendors directory
 * at /vendors (record + per-vendor COI list). Removed next release.
 */
export default function AdminCoisRedirect() {
  redirect("/vendors");
}
