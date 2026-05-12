import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/operator/app-shell";
import { NEW_SHELL } from "@/lib/feature-flags";

/**
 * Wraps every staff page in <ClerkProvider>. Vendor portal pages live under
 * `(vendor)/` and intentionally bypass Clerk so vendors can sign in via
 * magic-link without a Clerk org.
 *
 * When NEXT_PUBLIC_NEW_SHELL is on, the operator-loop redesign shell wraps
 * every (app) route. When off, pages render bare with their existing
 * per-page headers (legacy chrome).
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      {NEW_SHELL ? <AppShell>{children}</AppShell> : children}
    </ClerkProvider>
  );
}
