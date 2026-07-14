import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

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

export function googleAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function demoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !googleAuthConfigured();
}

const providers: Provider[] = googleAuthConfigured()
  ? [Google]
  : demoAuthEnabled()
    ? [
        Credentials({
          id: "demo",
          name: "Demo",
          credentials: {},
          authorize() {
            return {
              id: "local-demo-operator",
              email: "demo@stack.local",
              name: "Stack OS Demo",
            };
          },
        }),
      ]
    : [];

export const { handlers, signIn, signOut, auth: nextAuth } = NextAuth({
  providers,
  trustHost: process.env.NODE_ENV !== "production" || Boolean(process.env.VERCEL),
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    // Reject non-allow-listed accounts here — no session is created for them.
    signIn({ user }) {
      return emailAllowed(user.email);
    },
    redirect({ url, baseUrl }) {
      return safeRedirectUrl(url, baseUrl);
    },
    // Carry Google's stable subject id or the local demo id onto the session.
    jwt({ token, user, profile }) {
      if (profile?.sub) token.sub = profile.sub;
      else if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

function safeRedirectUrl(url: string, baseUrl: string): string {
  let target: URL;
  try {
    target = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url);
  } catch {
    return baseUrl;
  }

  if (!["http:", "https:"].includes(target.protocol)) return baseUrl;
  if (target.origin === baseUrl) return target.href;

  if (process.env.NODE_ENV !== "production" && isLocalDemoHost(target.hostname)) {
    return target.href;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      if (target.origin === new URL(appUrl).origin) return target.href;
    } catch {
      // Ignore malformed app URL config and fall back to Auth.js' base URL.
    }
  }

  return baseUrl;
}

function isLocalDemoHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1") {
    return true;
  }
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d+)\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}
