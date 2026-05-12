import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { SurfacePlaceholder } from "@/components/operator/surface-placeholder";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  return (
    <SurfacePlaceholder
      icon={CircleHelp}
      title="Help & shortcuts"
      description="Keyboard map and short docs. Built out alongside the command palette."
    />
  );
}
