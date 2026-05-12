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

const REDIRECTS = [
  { source: "/dashboard", destination: "/now" },
  { source: "/board", destination: "/work?view=board&type=wo" },
  { source: "/dispatcher", destination: "/work?view=dispatcher" },
  { source: "/work-orders", destination: "/work?type=wo" },
  { source: "/inspections", destination: "/work?type=ins" },
  { source: "/projects", destination: "/work?type=prj" },
  { source: "/admin/properties", destination: "/settings?section=properties" },
  { source: "/admin/vendors", destination: "/settings?section=vendors" },
  { source: "/admin/templates", destination: "/settings?section=templates" },
  {
    source: "/admin/compliance/cois",
    destination: "/compliance?tab=cois",
  },
  {
    source: "/admin/compliance/tenants",
    destination: "/compliance?tab=tenants",
  },
  { source: "/admin/approvals", destination: "/money?tab=approvals" },
  { source: "/admin/financials", destination: "/money?tab=invoices" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
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
