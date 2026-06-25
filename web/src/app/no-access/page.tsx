import Link from "next/link";

import { Page } from "@/components/ui/page";

/**
 * Shown when an authenticated user is not on the operator allow-list
 * (ALLOWED_OPERATOR_EMAILS). Lives outside the (app) route group so it never
 * re-enters withStaffScope (which would loop) — and deliberately uses no Clerk
 * components, since this route is outside ClerkProvider's scope.
 */
export default function NoAccessPage() {
  return (
    <Page as="main" width="narrow" className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          No access yet
        </h1>
        <p className="mt-2 text-body text-muted-foreground">
          Your account isn&rsquo;t set up for this workspace. Ask your operator
          to add your email, then{" "}
          <Link
            href="/sign-in"
            className="underline transition-colors hover:text-foreground"
          >
            sign in again
          </Link>
          .
        </p>
      </div>
    </Page>
  );
}
