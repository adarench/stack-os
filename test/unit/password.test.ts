import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  passwordMeetsPolicy,
  MIN_PASSWORD_LENGTH,
} from "@/lib/server/password";

describe("password hashing (M1)", () => {
  it("hashes then verifies a correct password; hash is not plaintext", async () => {
    const plain = "correct horse battery staple";
    const hash = await hashPassword(plain);
    expect(hash).not.toContain("correct horse");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt format
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("right-password-123");
    expect(await verifyPassword("wrong-password-123", hash)).toBe(false);
  });

  it("returns false (never throws) for a null/empty hash", async () => {
    expect(await verifyPassword("anything-here", null)).toBe(false);
    expect(await verifyPassword("anything-here", "")).toBe(false);
  });

  it("enforces the minimum-length policy", () => {
    expect(passwordMeetsPolicy("short")).toBe(false);
    expect(passwordMeetsPolicy("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });
});
