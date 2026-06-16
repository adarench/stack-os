import { NoAccessSignOut } from "./sign-out";

// Server component so we can opt out of static prerender (the Clerk sign-out
// button needs runtime context). Lives outside the (app) route group so it
// never re-enters withStaffScope (which would loop).
export const dynamic = "force-dynamic";

/**
 * Shown when an authenticated user is not on the operator allow-list
 * (ALLOWED_OPERATOR_EMAILS).
 */
export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-base font-semibold">No access yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn&rsquo;t set up for this workspace. Ask your operator
          to add your email, then sign in again.
        </p>
        <NoAccessSignOut />
      </div>
    </main>
  );
}
