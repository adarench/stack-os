/**
 * Rate limiter + auth audit (AUTH — brute-force protection + security events).
 * Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import postgres from "postgres";
import { rateLimit } from "@/lib/server/rate-limit";
import { recordAuthEvent } from "@/lib/server/auth-events";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const KEY = `test:rl:${Date.now()}`;
const EMAIL = `rl_${Date.now()}@x.test`;

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
});
afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await tx`set local role app_user`;
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', '_', true)`;
    await tx`delete from rate_limits where key = ${KEY}`;
    await tx`delete from auth_events where subject_email = ${EMAIL}`;
  });
  await admin.end();
});

describe.skipIf(skip)("rate limiter", () => {
  it("allows up to the limit, then blocks; resets after the window", async () => {
    // limit 3 in a long window
    expect((await rateLimit(KEY, 3, 60_000)).allowed).toBe(true); // 1
    expect((await rateLimit(KEY, 3, 60_000)).allowed).toBe(true); // 2
    expect((await rateLimit(KEY, 3, 60_000)).allowed).toBe(true); // 3
    expect((await rateLimit(KEY, 3, 60_000)).allowed).toBe(false); // 4 — blocked
    // A 0ms window means the next call is a fresh window → allowed again.
    expect((await rateLimit(KEY, 3, 0)).allowed).toBe(true);
  }, 20_000);
});

describe.skipIf(skip)("auth audit", () => {
  it("records a security event (no secrets)", async () => {
    await recordAuthEvent({ event: "login_failed", actorType: "tenant", subjectEmail: EMAIL, ip: "1.2.3.4" });
    const [row] = await admin!.begin(async (tx) => {
      await tx`set local role app_user`;
      await tx`select set_config('app.actor_type', 'system', true)`;
      await tx`select set_config('app.org_id', '_', true)`;
      return tx<{ event: string; ip: string; subject_email: string }[]>`
        select event, ip, subject_email from auth_events where subject_email = ${EMAIL} limit 1`;
    });
    expect(row!.event).toBe("login_failed");
    expect(row!.ip).toBe("1.2.3.4");
    expect(row!.subject_email).toBe(EMAIL.toLowerCase());
  }, 20_000);
});
