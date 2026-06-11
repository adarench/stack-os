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
