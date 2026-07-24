/**
 * Next.js instrumentation (M0 · OBS-002 seam / OBS-003).
 *
 * `onRequestError` is Next's global hook for uncaught server-side errors
 * (Server Components, route handlers, server actions). We route them through
 * the structured logger with a correlation id so unexpected failures are
 * observable in production (Vercel logs) instead of vanishing.
 *
 * This is the exact seam an error-tracking vendor plugs into later (OBS-002):
 * add `@sentry/nextjs`, set `SENTRY_DSN`, and call `Sentry.captureException`
 * here — no other wiring changes. See docs/lucid-rollout/RELEASE_CHECKLIST.md.
 */
import { logError } from "@/lib/server/logger";

type RequestInfo = { path?: string; method?: string };
type ErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

export function onRequestError(
  err: unknown,
  request: RequestInfo,
  context: ErrorContext,
): void {
  // Only method + path from the request — never headers/cookies (secrets).
  logError("server.request_error", err, {
    method: request?.method,
    path: request?.path,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    routeType: context?.routeType,
    renderSource: context?.renderSource,
  });
}
