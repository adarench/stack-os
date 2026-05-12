import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { SurfacePlaceholder } from "@/components/operator/surface-placeholder";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  return (
    <SurfacePlaceholder
      icon={Eye}
      title="Subscriptions"
      description="Entities you're watching. Anything that changes here shows up in Just changed on /now."
    />
  );
}
