import type { Metadata } from "next";

const SUPPORT_EMAIL = "support@bedrockwork.ai";
const PRODUCT = "Bedrock Work";

export const metadata: Metadata = {
  title: `${PRODUCT} Support`,
  description:
    "Support for Bedrock Work — the resident maintenance app for Stack Real Estate. How to submit requests, manage notifications, and get help.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/support" },
  // Override the root layout's internal-name metadata so no "Stack OS" appears
  // anywhere in the public /support HTML (incl. <head> meta tags).
  applicationName: PRODUCT,
  appleWebApp: { capable: true, statusBarStyle: "default", title: PRODUCT },
};

/**
 * Public support page for the Bedrock Work iOS app (the Apple-required Support
 * URL). Standalone — not under the internal-branded (legal) chrome — so it
 * presents the public app name "Bedrock Work". Reachable without authentication.
 * Stack Real Estate is named only as the property-management context.
 */
export default function SupportPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-5">
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em]">
            Bedrock&nbsp;Work
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Bedrock Work Support
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Bedrock Work is the resident maintenance app for Stack Real Estate.
          Submit maintenance requests and stay informed throughout the repair
          process.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Need help?</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            If you are having trouble accessing the app, receiving
            notifications, or submitting a maintenance request, please contact
            your property manager first — they can verify your account and unit.
          </p>

          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Technical support
            </p>
            <dl className="mt-3 space-y-2.5 text-[15px]">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="min-w-36 font-medium">Email</dt>
                <dd>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="min-w-36 font-medium">Response time</dt>
                <dd className="text-muted-foreground">1–2 business days</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Common issues</h2>

          <div className="mt-5 space-y-6">
            <div>
              <h3 className="text-base font-semibold">I can&rsquo;t log in</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Contact your property manager to verify your invitation.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">
                I am not receiving notifications
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Ensure notifications are enabled for Bedrock Work in iOS
                Settings.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">
                My maintenance request isn&rsquo;t updating
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Status updates are managed by your property&rsquo;s maintenance
                team.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-8 border-t border-border">
        <div className="mx-auto max-w-2xl px-5 py-8 text-xs text-muted-foreground">
          © 2026 Bedrock Work · a service for Stack Real Estate residents
        </div>
      </footer>
    </div>
  );
}
