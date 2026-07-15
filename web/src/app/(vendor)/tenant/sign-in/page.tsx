import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { Page } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function TenantSignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in → straight to the portal.
  const session = await readTenantSession();
  if (session) redirect("/tenant");

  const { error } = await searchParams;
  const message =
    error === "not_registered"
      ? "That Google account isn't on the resident list for this property. Ask your property manager to add you."
      : error === "google"
        ? "Google sign-in didn't complete. Please try again."
        : error
          ? "Something went wrong signing in. Please try again."
          : null;

  return (
    <Page
      as="main"
      width="narrow"
      className="flex min-h-dvh flex-col items-center justify-center text-center"
    >
      <h1 className="text-lg font-semibold tracking-tight text-foreground">
        Resident portal
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to submit and track maintenance requests for your unit.
      </p>

      {message && (
        <p className="mt-3 max-w-xs text-sm text-urgency-overdue" role="alert">
          {message}
        </p>
      )}

      {/* Full-page navigation into the OAuth flow (an API route, not a page) —
          Link would client-route and break the redirect. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/tenant/auth/google/start"
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-body font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40"
      >
        Sign in with Google
      </a>

      <p className="mt-4 text-meta text-muted-foreground">
        Use the Google account for the email your property manager invited.
      </p>
    </Page>
  );
}
