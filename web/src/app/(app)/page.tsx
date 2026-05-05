import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");
  redirect("/work-orders");
}
