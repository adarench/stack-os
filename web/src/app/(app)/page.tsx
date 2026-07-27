import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { NEW_SHELL } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, orgId, role } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");
  // Technicians land on their mobile field surface, not the operator cockpit (M4).
  if (role === "technician") redirect("/tech");
  redirect(NEW_SHELL ? "/my" : "/work");
}
