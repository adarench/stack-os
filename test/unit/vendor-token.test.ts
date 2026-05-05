import { describe, expect, it } from "vitest";
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens";

describe("vendor magic-link tokens", () => {
  it("generates url-safe tokens of sufficient length", () => {
    const t = generateToken();
    expect(t.length).toBeGreaterThanOrEqual(32);
    // base64url charset: A–Z a–z 0–9 - _
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toEqual(b);
  });

  it("hashes deterministically and one-way", () => {
    const t = "abc123";
    const h1 = hashToken(t);
    const h2 = hashToken(t);
    expect(h1).toEqual(h2);
    expect(h1).not.toEqual(t);
    // sha256 hex is 64 chars
    expect(h1).toHaveLength(64);
  });

  it("expiry is in the future and configurable", () => {
    const now = Date.now();
    const e = tokenExpiry();
    expect(e.getTime()).toBeGreaterThan(now);
    const short = tokenExpiry(60_000);
    expect(short.getTime() - now).toBeLessThan(120_000);
  });
});
