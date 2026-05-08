import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export { generateToken, hashToken, tokenExpiry } from "@/lib/tokens";

const COOKIE_NAME = "stack_tenant_session";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.VENDOR_MAGIC_LINK_SECRET;
  if (!s || s.length < 16) {
    throw new Error("VENDOR_MAGIC_LINK_SECRET missing or too short");
  }
  return s;
}

export interface TenantSession {
  orgId: string;
  tenantUserId: string;
}

export async function setTenantSessionCookie(session: TenantSession): Promise<void> {
  const payload = JSON.stringify(session);
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  const value = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  const c = await cookies();
  c.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function readTenantSession(): Promise<TenantSession | null> {
  let c;
  try {
    c = await cookies();
  } catch {
    return null;
  }
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const encoded = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(payload) as TenantSession;
    if (!parsed.orgId || !parsed.tenantUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearTenantSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
