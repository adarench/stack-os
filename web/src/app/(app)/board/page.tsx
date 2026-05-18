import { redirect } from "next/navigation";

/**
 * /board is folded into /work?view=board. Old links still work via this
 * redirect so we don't break shared URLs.
 */
export default function BoardRedirect() {
  redirect("/work?view=board");
}
