/**
 * Readiness probe (M0). Distinguishes a *configuration* failure (missing
 * required env) from a healthy deploy. Complements the liveness probe at
 * `/api/health` (which stays a trivial always-200 and is unchanged).
 *
 * NOTE: this checks env *presence only* — it never logs or returns secret
 * values, and it does NOT open a DB/storage/email connection. Deep dependency
 * health checks (DB reachable, storage reachable) are OBS-004 / milestone M8.
 */
export const dynamic = "force-dynamic";

// Env the app genuinely requires to function. Optional feature keys
// (RESEND_*, VAPID_*, INNGEST_*, TWILIO_*) are intentionally excluded —
// those degrade to documented stubs, not failures.
const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "VENDOR_MAGIC_LINK_SECRET",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

export function GET() {
  const missing = REQUIRED_ENV.filter((k) => !(process.env[k] && process.env[k]!.length > 0));
  const ok = missing.length === 0;
  const isProd = (process.env.APP_ENV ?? process.env.NODE_ENV) === "production";

  const body: Record<string, unknown> = {
    status: ok ? "ok" : "degraded",
    env: process.env.APP_ENV ?? "unknown",
  };
  if (!ok) {
    // In production, expose only a count (don't advertise which keys are
    // unset). In dev/preview, list the names to speed debugging.
    if (isProd) body.missingCount = missing.length;
    else body.missing = missing;
  }

  return Response.json(body, { status: ok ? 200 : 503 });
}
