import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { Page } from "@/components/ui/page";
import { changeOwnTenantPassword } from "./_actions";

export const dynamic = "force-dynamic";

export default async function TenantChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/sign-in");
  const { error } = await searchParams;
  const message =
    error === "mismatch" ? "Those passwords don't match." : error === "weak" ? "Use at least 10 characters." : null;

  return (
    <Page as="main" width="narrow" className="flex min-h-dvh flex-col items-center justify-center text-center">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">Choose your password</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Set a password you&rsquo;ll remember — you&rsquo;ll use it to sign in from now on.
      </p>
      {message && <p className="mt-3 max-w-xs text-sm text-urgency-overdue" role="alert">{message}</p>}
      <form action={changeOwnTenantPassword} className="mt-6 flex w-full max-w-xs flex-col gap-2 text-left">
        <label className="text-label font-medium text-foreground" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required
          className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <label className="mt-1 text-label font-medium text-foreground" htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required
          className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <p className="mt-1 text-meta text-muted-foreground">At least 10 characters.</p>
        <button type="submit" className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-foreground px-5 text-body font-medium text-background transition-colors hover:bg-foreground/90">
          Save password
        </button>
      </form>
    </Page>
  );
}
