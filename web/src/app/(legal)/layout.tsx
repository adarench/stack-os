import type { Viewport } from "next";
import { LegalFooter, LegalHeader } from "./_components";

/**
 * Public legal-document chrome. These routes (/privacy, /terms) sit outside
 * the (app) group so they render with no operator shell and no auth gate —
 * a Twilio A2P reviewer (or any visitor) can load them directly.
 *
 * The root layout pins the viewport (PWA, no user zoom). Legal pages are
 * read-heavy public documents, so we re-enable pinch-zoom here for
 * accessibility.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
};

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background">
      <LegalHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">{children}</main>
      <LegalFooter />
    </div>
  );
}
