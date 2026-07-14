import { headers } from "next/headers";
import { demoAuthEnabled, googleAuthConfigured, signIn } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Operator sign-in. Google OAuth via Auth.js. Non-allow-listed accounts are
 * rejected by the signIn callback (Auth.js redirects back here with
 * ?error=…), so we surface that.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const hasGoogleAuth = googleAuthConfigured();
  const hasDemoAuth = demoAuthEnabled();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">
              Stack&nbsp;·&nbsp;Ops
            </span>
            <h1 className="mt-5 text-lg font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Maintenance operations workspace
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-urgency-overdue/30 bg-urgency-overdue/5 px-3 py-2 text-center text-[13px] text-urgency-overdue">
              {error === "Configuration"
                ? "Google sign-in is not configured for this environment."
                : "That account is not set up for this workspace."}
            </div>
          )}

          {hasGoogleAuth && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: await redirectToHome() });
              }}
              className="mt-6"
            >
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-background text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>
          )}

          {hasDemoAuth && (
            <form
              action={async () => {
                "use server";
                await signIn("demo", { redirectTo: await redirectToHome() });
              }}
              className="mt-6"
            >
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background shadow-sm transition-colors hover:bg-foreground/90"
              >
                Continue in demo mode
              </button>
            </form>
          )}

          {!hasGoogleAuth && !hasDemoAuth && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Sign-in is not configured for this environment.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Access is invite-only. Trouble signing in? Contact your operator.
        </p>
      </div>
    </main>
  );
}

async function redirectToHome(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  if (!host) return "/";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}/`;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
