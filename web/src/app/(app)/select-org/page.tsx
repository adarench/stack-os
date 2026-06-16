import { redirect } from "next/navigation";

// Single-org pin: there is no org selection. Unreachable in practice (orgId is
// always pinned); kept as a safe redirect rather than a Clerk component.
export default function Page() {
  redirect("/");
}
