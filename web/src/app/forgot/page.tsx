import Link from "next/link";
import { requestStaffReset } from "./_actions";

export const dynamic = "force-dynamic";

export default async function StaffForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-background p-8 shadow-sm text-center">
          <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">
            Stack&nbsp;·&nbsp;Ops
          </span>
          <h1 className="mt-5 text-lg font-semibold tracking-tight">Reset your password</h1>

          {sent ? (
            <p className="mt-3 text-sm text-muted-foreground">
              If that email is registered, a reset link is on its way — it expires in 1 hour.
            </p>
          ) : (
            <form action={requestStaffReset} className="mt-6 space-y-3 text-left">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-foreground/30"
              />
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background shadow-sm transition-colors hover:bg-foreground/90"
              >
                Send reset link
              </button>
            </form>
          )}

          <Link href="/sign-in" className="mt-4 inline-block text-xs text-muted-foreground underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
