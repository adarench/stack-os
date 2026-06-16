import Link from "next/link";

/**
 * Shown when an authenticated user is not on the operator allow-list
 * (ALLOWED_OPERATOR_EMAILS). Lives outside the (app) route group so it never
 * re-enters withStaffScope (which would loop) — and deliberately uses no Clerk
 * components, since this route is outside ClerkProvider's scope.
 */
export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-base font-semibold">No access yet</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Your account isn&rsquo;t set up for this workspace. Ask your operator
          to add your email, then{" "}
          <Link href="/sign-in" className="underline hover:text-neutral-800">
            sign in again
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
