import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Operator sign-in. Google OAuth via Auth.js. Non-allow-listed accounts are
 * rejected by the signIn callback (Auth.js redirects back here with
 * ?error=AccessDenied), so we surface that.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <h1 className="text-base font-semibold">Sign in to Stack</h1>
        {error && (
          <p className="mt-2 text-sm text-red-600">
            That account isn&rsquo;t set up for this workspace. Ask your operator
            to add your email.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="mt-4 w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
