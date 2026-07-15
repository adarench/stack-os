import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { SubmitForm } from "@/components/tenant/submit-form";

export const dynamic = "force-dynamic";

/**
 * Submit a repair request. Category → what's wrong → detail → photos/video →
 * emergency flag → submit. Unit/property are taken from the session, so the
 * resident never picks them.
 */
export default async function NewTenantRequestPage() {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/sign-in");

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
        Report an issue
      </h1>
      <SubmitForm />
    </div>
  );
}
