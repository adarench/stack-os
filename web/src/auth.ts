import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) — staff/operator authentication. Replaces Clerk.
 *
 * Configured entirely by env vars (works on any URL incl. *.vercel.app, no
 * custom domain, no dashboard):
 *   AUTH_SECRET         — JWT signing secret
 *   AUTH_GOOGLE_ID      — Google OAuth client id   (your own OAuth app)
 *   AUTH_GOOGLE_SECRET  — Google OAuth client secret
 *
 * Access is gated by ALLOWED_OPERATOR_EMAILS (comma-separated). Non-listed
 * accounts are rejected at sign-in — no session is ever created. The single
 * org is pinned via STACK_ORG_ID in lib/server/auth.ts. Vendors and tenants
 * keep their separate magic-link auth, untouched.
 */

/** Operator allow-list. Empty = gate off (local dev only). */
function allowList(): string[] {
  return (process.env.ALLOWED_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function emailAllowed(email: string | null | undefined): boolean {
  const allow = allowList();
  if (allow.length === 0) return true;
  return !!email && allow.includes(email.toLowerCase());
}

export const { handlers, signIn, signOut, auth: nextAuth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    // Reject non-allow-listed accounts here — no session is created for them.
    signIn({ user }) {
      return emailAllowed(user.email);
    },
    // Carry Google's stable subject id onto the token + session.
    jwt({ token, profile }) {
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
