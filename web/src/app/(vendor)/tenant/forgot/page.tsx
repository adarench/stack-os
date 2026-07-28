import Link from "next/link";
import { Page } from "@/components/ui/page";
import { requestTenantReset } from "./_actions";

export const dynamic = "force-dynamic";

export default async function TenantForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <Page
      as="main"
      width="narrow"
      className="flex min-h-dvh flex-col items-center justify-center text-center"
    >
      <h1 className="text-lg font-semibold tracking-tight text-foreground">Reset your password</h1>

      {sent ? (
        <>
          <p className="mt-3 max-w-xs text-body text-foreground">
            If that email is registered, we&rsquo;ve sent a reset link. Check your inbox (and spam)
            — the link expires in 1 hour.
          </p>
          <Link href="/tenant/sign-in" className="mt-6 text-label text-muted-foreground underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&rsquo;ll send you a link to set a new password.
          </p>
          <form action={requestTenantReset} className="mt-6 flex w-full max-w-xs flex-col gap-2 text-left">
            <label className="text-label font-medium text-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11 rounded-md border border-border bg-card px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-foreground px-5 text-body font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Send reset link
            </button>
          </form>
          <Link href="/tenant/sign-in" className="mt-4 text-label text-muted-foreground underline">
            Back to sign in
          </Link>
        </>
      )}
    </Page>
  );
}
