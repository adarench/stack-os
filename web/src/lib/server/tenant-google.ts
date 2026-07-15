import "server-only";
import { eq } from "drizzle-orm";
import { withScope } from "./db";
import { tenantUsers } from "@db/schema/compliance";
import type { TenantSession } from "./tenant-auth";

/**
 * "Sign in with Google" for the tenant portal. Reuses the operator app's Google
 * OAuth client (AUTH_GOOGLE_ID/SECRET) but produces a *tenant* session, not an
 * operator one. The tenant_users roster is the allowlist — only an email that
 * was invited (has a tenant_users row) can sign in.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function clientId(): string {
  const id = process.env.AUTH_GOOGLE_ID;
  if (!id) throw new Error("AUTH_GOOGLE_ID missing");
  return id;
}
function clientSecret(): string {
  const s = process.env.AUTH_GOOGLE_SECRET;
  if (!s) throw new Error("AUTH_GOOGLE_SECRET missing");
  return s;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Exchange the auth code for the verified Google email. */
export async function exchangeCodeForEmail(
  code: string,
  redirectUri: string,
): Promise<{ email: string; emailVerified: boolean } | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;
  const parts = data.id_token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as { email?: string; email_verified?: boolean };
    if (!payload.email) return null;
    return {
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a Google-verified email to a tenant session. Returns null when the
 * email isn't on any tenant roster (i.e. not invited). Mirrors the magic-link
 * cross-org system lookup, then marks the tenant active.
 */
export async function findTenantByEmail(email: string): Promise<TenantSession | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await withScope(
    { orgId: "__system__", actorType: "system" },
    async (tx) =>
      tx
        .select({ id: tenantUsers.id, orgId: tenantUsers.orgId })
        .from(tenantUsers)
        .where(eq(tenantUsers.email, normalized))
        .limit(1),
  );
  const row = rows[0];
  if (!row) return null;

  await withScope({ orgId: row.orgId, actorType: "system" }, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({ lastSignedInAt: new Date(), status: "active", updatedAt: new Date() })
      .where(eq(tenantUsers.id, row.id));
  });

  return { orgId: row.orgId, tenantUserId: row.id };
}
