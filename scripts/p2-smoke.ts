/**
 * P2 production smoke test.
 *
 * Hits every public + auth-gated route on the deployed site and asserts:
 *   - public routes 200
 *   - auth-gated routes 307 → /sign-in (or /select-org / /vendor/invalid)
 *   - /api/health JSON 200
 *   - bad vendor magic-link redirects to /vendor/invalid
 *
 * Run: npx tsx scripts/p2-smoke.ts [base-url]
 *      defaults to https://stack-os-omega.vercel.app
 */
import { strict as assert } from "node:assert";

const BASE = process.argv[2] ?? "https://stack-os-six.vercel.app";

interface Result {
  path: string;
  expected: string;
  got: string;
  ok: boolean;
}

async function probe(path: string, expectedStatus: number, expectedLocationRegex?: RegExp) {
  const r = await fetch(BASE + path, { redirect: "manual" });
  const code = r.status;
  const location = r.headers.get("location") ?? "";
  let ok = code === expectedStatus;
  if (ok && expectedLocationRegex) ok = expectedLocationRegex.test(location);
  return {
    path,
    expected: `${expectedStatus}${expectedLocationRegex ? ` → ${expectedLocationRegex}` : ""}`,
    got: `${code}${location ? ` → ${location}` : ""}`,
    ok,
  };
}

async function main() {
  console.log(`P2 smoke target: ${BASE}\n`);

  const results: Result[] = [];

  // Public routes
  results.push(await probe("/sign-in", 200));
  results.push(await probe("/sign-up", 200));
  results.push(await probe("/vendor/invalid", 200));

  // Auth-gated → 307 to /sign-in (five operator surfaces + admin CRUD)
  for (const p of [
    "/",
    "/now",
    "/work",
    "/work/new",
    "/compliance",
    "/money",
    "/inbox",
    "/admin/properties",
    "/admin/vendors",
    "/admin/templates",
  ]) {
    results.push(await probe(p, 307, /\/sign-in/));
  }

  // Vendor portal without cookie → /vendor/invalid
  results.push(await probe("/vendor", 307, /\/vendor\/invalid/));

  // Bad magic-link → /vendor/invalid (path is /api/vendor/auth/[token])
  results.push(await probe("/api/vendor/auth/garbage_token_too_short_x", 307, /\/vendor\/invalid/));

  // /api/health JSON
  const h = await fetch(BASE + "/api/health");
  const hbody = await h.json().catch(() => ({}));
  results.push({
    path: "/api/health",
    expected: '200 {"ok":true,...}',
    got: `${h.status} ${JSON.stringify(hbody)}`,
    ok: h.status === 200 && (hbody as { ok?: boolean }).ok === true,
  });

  // /api/uploads/sign without auth → 401 JSON (it returns 401 explicitly,
  // not a redirect, because it's an API route)
  const u = await fetch(BASE + "/api/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  results.push({
    path: "/api/uploads/sign (POST, unauthed)",
    expected: "401",
    got: `${u.status}`,
    ok: u.status === 401,
  });

  // Print results
  let failed = 0;
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    console.log(`${icon} ${r.path.padEnd(50)} expected ${r.expected.padEnd(28)} got ${r.got}`);
    if (!r.ok) failed++;
  }

  console.log(`\n${results.length - failed}/${results.length} pass`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
