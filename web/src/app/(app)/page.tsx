import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NEW_SHELL } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");
  redirect(NEW_SHELL ? "/now" : "/work");
}
