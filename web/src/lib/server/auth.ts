import "server-only";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";

/**
 * Server-side session resolver. Drop-in replacement for `@clerk/nextjs/server`
 * `auth()` that does two things:
 *
 *  1. Pins the active org to STACK_ORG_ID. We run a single application
 *     organization today (one customer at a time), so the app does not use
 *     Clerk Organizations at runtime — every authenticated user is scoped to
 *     the one org. This removes the /select-org dead-end entirely. When a
 *     second customer arrives, drop STACK_ORG_ID and read Clerk's real orgId
 *     here again; the org_id column + RLS are already multi-tenant-ready.
 *
 *  2. Provides a headless e2e bypass (E2E_BYPASS_AUTH=1) — dev only, never
 *     set in production.
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
  // Single-org pin: STACK_ORG_ID wins; Clerk's per-user org is the fallback
  // (and the path back to multi-tenant later).
  const orgId = process.env.STACK_ORG_ID ?? result.orgId ?? null;
  return { userId: result.userId, orgId };
}

/**
 * Access gate for the single org. Because the org is pinned, "has a Clerk
 * account" would otherwise equal "operator access" — so we gate on an explicit
 * allow-list of operator emails (ALLOWED_OPERATOR_EMAILS, comma-separated).
 *
 * This is the code-side enforcement of invitation-only access; the primary
 * gate should also be Clerk's "restrict sign-ups to invitations" in the
 * dashboard. When ALLOWED_OPERATOR_EMAILS is unset, the gate is OFF (so local
 * dev and the e2e bypass keep working) — it MUST be set (or Clerk sign-ups
 * restricted) in production.
 *
 * currentUser() is only fetched when the gate is actually configured.
 */
export async function isOperatorAllowed(): Promise<boolean> {
  if (process.env.E2E_BYPASS_AUTH === "1") return true;
  const allow = (process.env.ALLOWED_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true; // gate disabled when unconfigured
  const u = await currentUser();
  const email = (
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress ??
    ""
  ).toLowerCase();
  return !!email && allow.includes(email);
}
