import type { NextConfig } from "next";

/**
 * Legacy → redesign redirect map. Only active when NEXT_PUBLIC_NEW_SHELL is
 * on; while off, the old admin/list routes keep working unchanged.
 *
 * Parameterised legacy paths (e.g. `/work-orders/:id`) are not redirected
 * here — Next.js redirects cannot translate a UUID into a `WO-N` ref. Those
 * pages keep their legacy route during the migration window and the new
 * `EntityDrawer` deep-link (`?d=WO-N`) provides the shareable URL.
 */
const newShellOn =
  process.env.NEXT_PUBLIC_NEW_SHELL === "1" ||
  process.env.NEXT_PUBLIC_NEW_SHELL === "true";

/**
 * Only routes with NO live page of their own belong here. /inspections,
 * /projects, /admin/* are real destinations again (lists, record forms,
 * recurring-task presets) — redirecting them away made them unreachable and
 * the /admin/* → /settings entries looped (settings page-redirects back to
 * /admin/properties).
 */
const REDIRECTS = [
  { source: "/dashboard", destination: "/my" },
  { source: "/board", destination: "/work?view=board&type=wo" },
  { source: "/dispatcher", destination: "/work?view=dispatcher" },
  { source: "/work-orders", destination: "/work?type=wo" },
  { source: "/admin/approvals", destination: "/money?tab=approvals" },
];

/**
 * Content-Security-Policy — shipped **report-only** first (SEC/D4). Report-only
 * never blocks a request; the browser just reports what *would* have been
 * refused, so we can watch for violations before switching to enforcing without
 * risking a broken page. `script-src`/`style-src` keep `'unsafe-inline'` for now
 * because the App Router injects an inline hydration bootstrap and Tailwind/inline
 * styles are pervasive; the enforce step is a follow-up that adds per-request
 * nonces. Even report-only, the value is real: it documents the intended policy
 * and surfaces regressions. `img-src`/`connect-src` allow `https:` because photos
 * are served from and uploaded to R2 signed URLs on a Cloudflare host.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

/**
 * Baseline security headers. Covers the checks a client's IT reviewer will run:
 * clickjacking, MIME-sniffing, referrer leakage, HSTS, a locked-down permissions
 * policy (camera allowed for photo capture only), and a report-only CSP.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    if (!newShellOn) return [];
    return REDIRECTS.map((r) => ({
      source: r.source,
      destination: r.destination,
      permanent: false,
    }));
  },
};

export default nextConfig;
