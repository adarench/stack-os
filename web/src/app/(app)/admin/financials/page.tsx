import { redirect } from "next/navigation";

/**
 * Financials merged into Money → Invoices (submit invoice + status transitions
 * now live alongside monitoring on one Finance surface).
 */
export default function FinancialsRedirect() {
  redirect("/money?tab=invoices");
}
