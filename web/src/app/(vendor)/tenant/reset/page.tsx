import Link from "next/link";
import { Page } from "@/components/ui/page";
import { completeTenantReset } from "./_actions";

export const dynamic = "force-dynamic";

export default async function TenantResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <Page as="main" width="narrow" className="flex min-h-dvh flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Reset link invalid</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          This reset link is missing or malformed. Request a new one.
        </p>
        <Link href="/tenant/forgot" className="mt-6 text-label text-muted-foreground underline">
          Request a new link
        </Link>
      </Page>
    );
  }

  const message =
    error === "mismatch"
      ? "Those passwords don't match."
      : error === "weak_password"
        ? "Use at least 10 characters."
        : error === "invalid_or_expired"
          ? "This reset link has expired or already been used. Request a new one."
          : error
            ? "Something went wrong. Request a new link."
            : null;

  return (
    <Page as="main" width="narrow" className="flex min-h-dvh flex-col items-center justify-center text-center">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">Set a new password</h1>

      {message && (
        <p className="mt-3 max-w-xs text-sm text-urgency-overdue" role="alert">
          {message}
        </p>
      )}

      <form action={completeTenantReset} className="mt-6 flex w-full max-w-xs flex-col gap-2 text-left">
        <input type="hidden" name="token" value={token} />
        <label className="text-label font-medium text-foreground" htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="mt-1 text-label font-medium text-foreground" htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-1 text-meta text-muted-foreground">At least 10 characters.</p>
        <button
          type="submit"
          className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-foreground px-5 text-body font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Set password
        </button>
      </form>
    </Page>
  );
}
