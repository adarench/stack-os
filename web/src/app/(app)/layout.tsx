import { ClerkProvider } from "@clerk/nextjs";

/**
 * Wraps every staff page in <ClerkProvider>. Vendor portal pages live under
 * `(vendor)/` and intentionally bypass Clerk so vendors can sign in via
 * magic-link without a Clerk org.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
