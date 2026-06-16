import { auth } from "@/lib/server/auth";
import { AppShell } from "@/components/operator/app-shell";
import { NEW_SHELL } from "@/lib/feature-flags";
import { loadShellSummary, type ShellSummary } from "@/lib/server/shell";

/**
 * Staff/operator layout. Auth is Auth.js (Google) — no provider wrapper
 * needed; the server reads the session directly. Vendor portal pages live
 * under `(vendor)/` and use their own magic-link auth.
 *
 * The operator shell (when NEW_SHELL is on) needs a single org-scoped
 * summary to render the persistent status line and rail badges. We fetch
 * it here so it lives on the layout boundary — children pages don't need
 * to know about it and one query feeds the whole shell.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let summary: ShellSummary | null = null;
  if (NEW_SHELL) {
    const { userId, orgId } = await auth();
    if (userId && orgId) {
      try {
        summary = await loadShellSummary();
      } catch {
        // If RLS context isn't set up yet (e.g. fresh org before first
        // page load), don't block the layout — fall back to no badges.
        summary = null;
      }
    }
  }
  return NEW_SHELL ? (
    <AppShell summary={summary}>{children}</AppShell>
  ) : (
    <>{children}</>
  );
}
