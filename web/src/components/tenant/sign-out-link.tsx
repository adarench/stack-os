"use client";

import { unsubscribePush } from "@/lib/push-client";

/**
 * Tenant sign-out. Tears down this device's push subscription first (so a shared
 * phone stops getting the previous resident's alerts), then hits the signout
 * route which clears the cookie + redirects. Cleanup is best-effort and never
 * blocks the sign-out.
 */
export function SignOutLink({ className }: { className?: string }) {
  return (
    // Signout is a route handler, not a page; the <a> is the no-JS fallback.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/api/tenant/auth/signout"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        void unsubscribePush("/api/tenant/push/subscribe").finally(() => {
          window.location.href = "/api/tenant/auth/signout";
        });
      }}
    >
      Sign out
    </a>
  );
}
