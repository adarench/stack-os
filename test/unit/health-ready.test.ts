import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/ready/route";

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "VENDOR_MAGIC_LINK_SECRET",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const MANAGED = [...REQUIRED, "APP_ENV", "NODE_ENV"];

let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = {};
  for (const k of MANAGED) snapshot[k] = process.env[k];
  // Start each test from a clean slate for the keys we manage.
  for (const k of MANAGED) delete process.env[k];
});

afterEach(() => {
  for (const k of MANAGED) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("readiness handler (/api/health/ready)", () => {
  it("returns 200 ok when all required env is present", async () => {
    for (const k of REQUIRED) process.env[k] = "x";
    const res = GET();
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ status: "ok" });
  });

  it("returns 503 degraded and lists missing NAMES (not values) in non-prod", async () => {
    for (const k of REQUIRED) process.env[k] = "x";
    delete process.env.DATABASE_URL; // simulate one missing
    process.env.APP_ENV = "development";
    const res = GET();
    expect(res.status).toBe(503);
    const b = await body(res);
    expect(b.status).toBe("degraded");
    expect(b.missing).toContain("DATABASE_URL");
    expect(b.missingCount).toBeUndefined();
  });

  it("hides which keys are missing in production (count only, no names)", async () => {
    process.env.APP_ENV = "production"; // all REQUIRED absent
    const res = GET();
    expect(res.status).toBe(503);
    const b = await body(res);
    expect(b.status).toBe("degraded");
    expect(typeof b.missingCount).toBe("number");
    expect(b.missing).toBeUndefined();
  });

  it("never returns secret VALUES, only names/counts", async () => {
    for (const k of REQUIRED) process.env[k] = "super-secret-value";
    delete process.env.S3_BUCKET;
    const res = GET();
    const raw = JSON.stringify(await body(res));
    expect(raw).not.toContain("super-secret-value");
  });
});
