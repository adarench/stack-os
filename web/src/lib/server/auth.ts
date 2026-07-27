import "server-only";
import { nextAuth, emailAllowed } from "@/auth";

/**
 * Server-side session resolver. Maps the Auth.js (Google) session into the
 * shape the app uses, and pins the single org.
 *
 *  1. Single-org pin: orgId = STACK_ORG_ID. We run one customer org today, so
 *     the app does not model multiple orgs at runtime. (Drop the pin and derive
 *     orgId per-user to go multi-tenant later.)
 *  2. E2E bypass (E2E_BYPASS_AUTH=1) — dev only, never set in production.
 */
export async function auth(): Promise<{
  userId: string | null;
  orgId: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
}> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return {
      userId: "user_3DK8x0ZupgoiJrfdkzcgN0BpXCR",
      orgId: "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0",
      email: "adam.rencher12@gmail.com",
      name: "Adam Rencher",
      role: "admin",
    };
  }
  const session = await nextAuth();
  const user = session?.user;
  // Stable identity: OAuth/credential subject id (falls back to email).
  const userId = user?.id ?? user?.email ?? null;
  const orgId = userId ? (process.env.STACK_ORG_ID ?? null) : null;
  return {
    userId,
    orgId,
    email: user?.email ?? null,
    name: user?.name ?? null,
    // Populated for credential logins; null for OAuth (read from DB when needed).
    role: (user as { role?: string } | undefined)?.role ?? null,
  };
}

/**
 * Operator access gate (defense-in-depth — the primary gate is the Auth.js
 * signIn callback, which never issues a session to a non-listed email).
 */
export async function isOperatorAllowed(): Promise<boolean> {
  if (process.env.E2E_BYPASS_AUTH === "1") return true;
  const { email } = await auth();
  return emailAllowed(email);
}
