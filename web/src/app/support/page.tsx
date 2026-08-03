import type { Metadata } from "next";

const SUPPORT_EMAIL = "support@bedrock-ai.co";
const WEBSITE = "https://bedrock-ai.co";
const PRODUCT = "Bedrock Work";

export const metadata: Metadata = {
  title: `${PRODUCT} Support`,
  description:
    "Support for Bedrock Work — how to submit maintenance requests, manage notifications, and get technical help.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/support" },
};

/**
 * Public support page for the Bedrock Work iOS app. Standalone (not under the
 * (legal) chrome, which is Stack-branded) so the Apple-required Support URL
 * presents Bedrock branding, and reachable without authentication.
 */
export default function SupportPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-5">
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em]">
            Bedrock&nbsp;·&nbsp;Work
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Bedrock Work Support
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Bedrock Work helps tenants submit maintenance requests and stay
          informed throughout the repair process.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Need Help?</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            If you are having trouble accessing the app, receiving
            notifications, or submitting a maintenance request, please contact
            your property manager first.
          </p>

          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              For technical support
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
                <dt className="min-w-36 font-medium">Website</dt>
                <dd>
                  <a
                    href={WEBSITE}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {WEBSITE}
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
          <h2 className="text-xl font-semibold tracking-tight">Common Issues</h2>

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
          © 2026 Bedrock AI
        </div>
      </footer>
    </div>
  );
}
