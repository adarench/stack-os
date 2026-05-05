import { createHash, randomBytes } from "node:crypto";

/**
 * Pure token crypto helpers — safe to import from server, jobs, and tests.
 * Cookie/session helpers live in /lib/server/vendor-auth.ts.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function tokenExpiry(ttlMs = 7 * 24 * 60 * 60 * 1000): Date {
  return new Date(Date.now() + ttlMs);
}
