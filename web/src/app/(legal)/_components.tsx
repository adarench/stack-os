import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  COMPANY_LEGAL_NAME,
  PRIVACY_EMAIL,
  PRODUCT_NAME,
  SUPPORT_EMAIL,
} from "./_config";

/* ──────────────────────────────────────────────────────────────────
 * Public chrome — header + footer shared by every legal document.
 * Plain server components; no client JS, no app shell, no auth.
 * ──────────────────────────────────────────────────────────────── */

export function LegalHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-foreground transition-colors hover:text-foreground/70"
        >
          Stack&nbsp;·&nbsp;OS
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <HeaderLink href="/privacy">Privacy</HeaderLink>
          <HeaderLink href="/terms">Terms</HeaderLink>
          <Link
            href="/sign-in"
            className="ml-1 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: "/privacy" | "/terms"; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}

export function LegalFooter() {
  const year = LAST_UPDATED_YEAR;
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-foreground">
              Stack&nbsp;·&nbsp;OS
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {PRODUCT_NAME} is a property management operations platform. SMS
              messages we send are transactional and operational only — never
              marketing.
            </p>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {SUPPORT_EMAIL}
            </a>
          </nav>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          © {year} {COMPANY_LEGAL_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: "/privacy" | "/terms"; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Document typography helpers. No @tailwindcss/typography in the build,
 * so prose styling is composed by hand from the semantic tokens.
 * ──────────────────────────────────────────────────────────────── */

export function DocHeader({
  title,
  lastUpdated,
  intro,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
}) {
  return (
    <div className="border-b border-border pb-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {PRODUCT_NAME} Legal
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated:{" "}
        <time className="font-medium text-foreground">{lastUpdated}</time>
      </p>
      <p className="mt-5 text-base leading-relaxed text-muted-foreground">{intro}</p>
    </div>
  );
}

/** Compact, anchor-linked table of contents. */
export function TableOfContents({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <nav
      aria-label="Table of contents"
      className="my-8 rounded-xl border border-border bg-muted/30 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        On this page
      </p>
      <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="flex gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="tabular-nums text-foreground/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{it.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border py-8 first:border-t-0">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        <a href={`#${id}`} className="group inline-flex items-baseline gap-2">
          {title}
          <span
            aria-hidden
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            #
          </span>
        </a>
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-foreground">{children}</h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/30" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Highlighted callout — used for the SMS / messaging disclosures. */
export function Callout({
  title,
  children,
  tone = "brand",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "brand" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        tone === "brand"
          ? "border-urgency-brand/25 bg-urgency-brand/5"
          : "border-border bg-muted/40",
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function ContactCard({
  lines,
}: {
  lines: { label: string; value: string; href?: string }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <dl className="space-y-2 text-[15px]">
        {lines.map((l) => (
          <div key={l.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="min-w-32 font-medium text-foreground">{l.label}</dt>
            <dd className="text-muted-foreground">
              {l.href ? (
                <a href={l.href} className="underline-offset-2 hover:underline">
                  {l.value}
                </a>
              ) : (
                l.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Re-exported so the footer can render a year without importing dates. */
const LAST_UPDATED_YEAR = "2026";

/** Shared contact lines used in both documents' "Contact" section. */
export const CONTACT_LINES = [
  { label: "General / Support", value: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
  { label: "Privacy requests", value: PRIVACY_EMAIL, href: `mailto:${PRIVACY_EMAIL}` },
  { label: "Entity", value: COMPANY_LEGAL_NAME },
];
