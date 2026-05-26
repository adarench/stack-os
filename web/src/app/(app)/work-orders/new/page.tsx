import { redirect } from "next/navigation";

/**
 * Stage A redirect. WO creation moves to /work/new under the operator shell.
 * Removed in the next release.
 */
export default function NewWorkOrderRedirect() {
  redirect("/work/new");
}
