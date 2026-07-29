import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { changeOwnStaffPassword } from "./_actions";

export const dynamic = "force-dynamic";

export default async function StaffChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { error } = await searchParams;
  const inputCls =
    "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-foreground/30";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-background p-8 shadow-sm text-center">
          <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">
            Stack&nbsp;·&nbsp;Ops
          </span>
          <h1 className="mt-5 text-lg font-semibold tracking-tight">Choose your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set a password you&rsquo;ll use to sign in from now on.</p>
          {error && (
            <p className="mt-3 text-sm text-urgency-overdue" role="alert">
              {error === "mismatch" ? "Those passwords don't match." : "Use at least 10 characters."}
            </p>
          )}
          <form action={changeOwnStaffPassword} className="mt-6 space-y-3 text-left">
            <input name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="New password" className={inputCls} />
            <input name="confirm" type="password" autoComplete="new-password" minLength={10} required placeholder="Confirm password" className={inputCls} />
            <p className="text-[11px] text-muted-foreground">At least 10 characters.</p>
            <button type="submit" className="flex h-11 w-full items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background shadow-sm transition-colors hover:bg-foreground/90">
              Save password
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
