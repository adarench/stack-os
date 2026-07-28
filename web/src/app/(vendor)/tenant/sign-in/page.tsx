import Link from "next/link";
import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { credentialAuthEnabled } from "@/auth";
import { Page } from "@/components/ui/page";
import { signInTenant } from "./_actions";

export const dynamic = "force-dynamic";

export default async function TenantSignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  // Already signed in → straight to the portal.
  const session = await readTenantSession();
  if (session) redirect("/tenant");

  const { error, reset } = await searchParams;
  const message =
    error === "bad_credentials"
      ? "That email and password don't match. Check them and try again."
      : error === "not_registered"
        ? "That Google account isn't on the resident list for this property. Ask your property manager to add you."
        : error === "google"
          ? "Google sign-in didn't complete. Please try again."
          : error === "config"
            ? "Sign-in isn't configured yet. Please contact your property manager."
            : error
              ? "Something went wrong signing in. Please try again."
              : null;

  const passwordLogin = credentialAuthEnabled();

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

      {reset && (
        <p className="mt-3 max-w-xs text-sm text-urgency-done" role="status">
          Password updated. Sign in with your new password.
        </p>
      )}

      {passwordLogin && (
        <form action={signInTenant} className="mt-6 flex w-full max-w-xs flex-col gap-2 text-left">
          <label className="text-label font-medium text-foreground" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <label className="mt-1 text-label font-medium text-foreground" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-foreground px-5 text-body font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Sign in
          </button>
          <Link href="/tenant/forgot" className="mt-1 text-center text-label text-muted-foreground underline">
            Forgot password?
          </Link>
        </form>
      )}

      {/* Google is disabled when password login is on (unreliable on the
          client network). Shown only as a fallback when credentials are off. */}
      {!passwordLogin && (
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/api/tenant/auth/google/start"
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-body font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40"
        >
          Sign in with Google
        </a>
      )}

      <p className="mt-4 text-meta text-muted-foreground">
        {passwordLogin
          ? "Use the email and password your property manager set up for you."
          : "Use the Google account for the email your property manager invited."}
      </p>
    </Page>
  );
}
