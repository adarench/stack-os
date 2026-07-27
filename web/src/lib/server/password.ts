import "server-only";
import bcrypt from "bcryptjs";

/**
 * Password hashing (M1 · AUTH-002). bcrypt (cost 12) — pure-JS, no native
 * binding, safe on every runtime. Argon2id is a documented future swap
 * (AUTH_SPEC §2). Never store, log, or transmit the plaintext.
 */
const COST = 12;

/** Minimum password policy (AUTH_SPEC §5). */
export const MIN_PASSWORD_LENGTH = 10;

export function passwordMeetsPolicy(plain: string): boolean {
  return typeof plain === "string" && plain.length >= MIN_PASSWORD_LENGTH;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/**
 * Verify a password against a stored hash. When `hash` is null/empty we still
 * spend comparable work (a throwaway hash) so an attacker cannot distinguish
 * "no such account / no password set" from "wrong password" by timing.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    // Constant-ish work, then fail — no timing oracle on account existence.
    try {
      await bcrypt.hash(plain, COST);
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
