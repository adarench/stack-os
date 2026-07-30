import "server-only";
import http2 from "node:http2";
import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { tenantDeviceTokens } from "@db/schema/push-subscriptions";
import type { ScopedDB } from "./db";

/**
 * Native APNs (Apple Push Notification service) delivery for the tenant iOS app.
 * Mirrors the web-push/email pattern: **stub-until-keyed** — with no APNs key
 * configured, sends log + resolve successfully so dev, tests, and the current
 * (keyless) production never break. Goes live the instant these env vars are set:
 *
 *   APNS_KEY        — the .p8 auth key contents (PEM, "-----BEGIN PRIVATE KEY-----…")
 *   APNS_KEY_ID     — the 10-char Key ID from the Apple developer portal
 *   APNS_TEAM_ID    — your Apple Team ID
 *   APNS_BUNDLE_ID  — app bundle id (default us.stackstorage.tenant)
 *   APNS_PRODUCTION — "1" for api.push.apple.com, else the sandbox host
 *
 * Token auth (JWT, ES256) — no certificates. The JWT is reused up to ~50 min
 * (Apple allows 60). Uses Node's built-in http2 (APNs is HTTP/2-only).
 */
const teamId = process.env.APNS_TEAM_ID;
const keyId = process.env.APNS_KEY_ID;
const p8 = process.env.APNS_KEY?.replace(/\\n/g, "\n");
const bundleId = process.env.APNS_BUNDLE_ID ?? "us.stackstorage.tenant";
const production = process.env.APNS_PRODUCTION === "1" || process.env.APNS_PRODUCTION === "true";
const configured = !!(teamId && keyId && p8);
const HOST = production ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";

export const apnsConfigured = (): boolean => configured;

export interface ApnsPayload {
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped (routed by the shell). */
  url?: string;
  /** Coalescing tag (APNs thread-id) so repeats about one entity collapse. */
  tag?: string;
}

let cachedJwt: { token: string; iat: number } | null = null;
function apnsJwt(nowSec: number): string {
  if (cachedJwt && nowSec - cachedJwt.iat < 50 * 60) return cachedJwt.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: teamId, iat: nowSec })}`;
  // ES256 JWS needs the raw r||s signature (ieee-p1363), not DER.
  const sig = crypto
    .sign("sha256", Buffer.from(signingInput), { key: p8!, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  const token = `${signingInput}.${sig}`;
  cachedJwt = { token, iat: nowSec };
  return token;
}

/** Send one native push. `gone: true` on an expired/invalid token → prune it. */
export async function sendApns(
  token: string,
  payload: ApnsPayload,
): Promise<{ ok: boolean; gone: boolean; error?: string }> {
  if (!configured) {
    // eslint-disable-next-line no-console
    console.log("[apns:stub]", payload.title, "→", token.slice(0, 12));
    return { ok: true, gone: false };
  }
  const jwt = apnsJwt(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default", "thread-id": payload.tag ?? undefined },
    url: payload.url ?? "/tenant",
  });
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: { ok: boolean; gone: boolean; error?: string }) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const client = http2.connect(HOST);
    client.on("error", (e) => done({ ok: false, gone: false, error: String(e).slice(0, 200) }));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      client.close();
      if (status >= 200 && status < 300) return done({ ok: true, gone: false });
      const gone = status === 410 || /BadDeviceToken|Unregistered/.test(data);
      done({ ok: false, gone, error: `apns ${status} ${data}`.slice(0, 200) });
    });
    req.on("error", (e) => { client.close(); done({ ok: false, gone: false, error: String(e).slice(0, 200) }); });
    req.setTimeout(8000, () => { req.close(); client.close(); done({ ok: false, gone: false, error: "apns timeout" }); });
    req.write(body);
    req.end();
  });
}

/* -------------------- tenant device-token storage -------------------- */

export async function loadTenantDeviceTokens(
  tx: ScopedDB,
  orgId: string,
  tenantUserId: string,
): Promise<Array<{ id: string; token: string }>> {
  return tx
    .select({ id: tenantDeviceTokens.id, token: tenantDeviceTokens.token })
    .from(tenantDeviceTokens)
    .where(
      and(
        eq(tenantDeviceTokens.orgId, orgId),
        eq(tenantDeviceTokens.tenantUserId, tenantUserId),
        isNull(tenantDeviceTokens.deletedAt),
      ),
    );
}

/** Upsert a device token by token (re-register from the same install refreshes). */
export async function saveTenantDeviceToken(
  tx: ScopedDB,
  input: { orgId: string; tenantUserId: string; token: string; platform?: string; userAgent?: string | null },
): Promise<void> {
  await tx
    .insert(tenantDeviceTokens)
    .values({
      orgId: input.orgId,
      tenantUserId: input.tenantUserId,
      token: input.token,
      platform: input.platform ?? "ios",
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: tenantDeviceTokens.token,
      set: {
        tenantUserId: input.tenantUserId,
        platform: input.platform ?? "ios",
        userAgent: input.userAgent ?? null,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
}

/** Soft-prune a device token (sign-out on this device, or APNs said gone). */
export async function pruneTenantDeviceToken(tx: ScopedDB, id: string): Promise<void> {
  await tx
    .update(tenantDeviceTokens)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenantDeviceTokens.id, id));
}
