/**
 * Vendor portal pages bypass <ClerkProvider> — vendors authenticate via
 * the magic-link cookie set in /lib/server/vendor-auth.ts.
 */
export default function VendorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
