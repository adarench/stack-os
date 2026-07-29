import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { rateLimits } from "@db/schema/auth-infra";
import { withScope } from "./db";
import { logger } from "./logger";

/**
 * DB-backed fixed-window rate limiter for pre-auth endpoints (login + reset).
 * Additive to the per-account lockout: this throttles by IP/email so an attacker
 * can't spread guesses across many accounts. Fail-open on any DB error — a limiter
 * outage must never lock everyone out of login.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean }> {
  const now = Date.now();
  try {
    return await withScope({ orgId: "_", actorType: "system" }, async (tx) => {
      const [row] = await tx.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
      if (!row) {
        await tx.insert(rateLimits).values({ key, count: 1, windowStart: new Date(now) }).onConflictDoNothing();
        return { allowed: true };
      }
      if (now - row.windowStart.getTime() > windowMs) {
        await tx.update(rateLimits).set({ count: 1, windowStart: new Date(now) }).where(eq(rateLimits.key, key));
        return { allowed: true };
      }
      const next = row.count + 1;
      await tx.update(rateLimits).set({ count: next }).where(eq(rateLimits.key, key));
      return { allowed: next <= limit };
    });
  } catch (err) {
    logger.warn("ratelimit.error", { err });
    return { allowed: true }; // fail open
  }
}

/** Best-effort client IP from the proxy headers (Vercel). */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return (fwd?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  } catch {
    return "unknown";
  }
}
