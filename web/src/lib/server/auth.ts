import "server-only";
import { auth as clerkAuth } from "@clerk/nextjs/server";

/**
 * Server-side session resolver. Drop-in replacement for `@clerk/nextjs/server`
 * `auth()` that adds a single env-gated bypass for headless e2e screenshots.
 *
 *   E2E_BYPASS_AUTH=1 pnpm dev
 *
 * When the env var is set, returns a fixed session for Adam Rencher's seed
 * org. NEVER set this in production — it's safe by construction (the env
 * var won't exist there) but treat it as a sharp tool.
 *
 * Real-user requests are unaffected: when the env var is absent, this is
 * a pure pass-through to Clerk.
 */
export async function auth(): Promise<{
  userId: string | null;
  orgId: string | null;
}> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return {
      userId: "user_3DK8x0ZupgoiJrfdkzcgN0BpXCR",
      orgId: "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0",
    };
  }
  const result = await clerkAuth();
  return { userId: result.userId, orgId: result.orgId ?? null };
}
