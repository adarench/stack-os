import "server-only";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, type DB } from "@db/client";
import { auth } from "./auth";

export type ScopedDB = Parameters<Parameters<DB["transaction"]>[0]>[0];

type ActorType = "user" | "vendor" | "tenant" | "system" | "inngest";

interface ScopeOpts {
  orgId: string;
  actorType?: ActorType;
  vendorUserId?: string;
  tenantUserId?: string;
}

/**
 * Run `fn` inside a transaction with `app.org_id`, `app.actor_type`, and
 * (optionally) `app.vendor_user_id` set as session-local vars. RLS policies
 * read these via `current_org_id()` etc.
 *
 * Use {@link withStaffScope} or {@link withVendorScope} from API routes /
 * server actions; this primitive is for jobs and tests.
 */
export async function withScope<T>(
  opts: ScopeOpts,
  fn: (tx: ScopedDB) => Promise<T>,
): Promise<T> {
  const actorType: ActorType = opts.actorType ?? "user";
  return db.transaction(async (tx) => {
    // Drop privileges to the RLS-enforced role and set scope vars in ONE
    // round-trip. Multi-statement query: `SET LOCAL ROLE` cannot be combined
    // with `set_config()` calls, so we send them as a single semicolon-
    // separated statement. Reduces 4 WS round-trips to Neon down to 1 —
    // critical for sub-1s authed page renders on Vercel cold starts.
    const orgId = escapeLiteral(opts.orgId);
    const actor = escapeLiteral(actorType);
    let preamble =
      `set local role app_user; ` +
      `set local app.org_id = '${orgId}'; ` +
      `set local app.actor_type = '${actor}';`;
    if (opts.vendorUserId) {
      preamble += ` set local app.vendor_user_id = '${escapeLiteral(opts.vendorUserId)}';`;
    }
    if (opts.tenantUserId) {
      preamble += ` set local app.tenant_user_id = '${escapeLiteral(opts.tenantUserId)}';`;
    }
    await tx.execute(sql.raw(preamble));
    return fn(tx);
  });
}

/**
 * Resolve the active Clerk org and run `fn` inside a transaction with RLS
 * session vars set.
 *
 * Unauthenticated callers get redirected to /sign-in via Next's `redirect()`,
 * which throws a `NEXT_REDIRECT` error that the framework catches and
 * converts into a 307. Same for missing-org → /select-org. This lets every
 * protected page just call `withStaffScope(...)` without each one repeating
 * the auth-check + redirect dance.
 *
 * For API routes that should return a JSON 401 instead of redirecting,
 * call `auth()` directly and branch.
 */
export async function withStaffScope<T>(
  fn: (tx: ScopedDB, ctx: { orgId: string; userId: string }) => Promise<T>,
): Promise<T> {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");
  return withScope({ orgId, actorType: "user" }, (tx) => fn(tx, { orgId, userId }));
}

/**
 * Vendor-scoped variant. Caller resolves vendor session via cookie.
 */
export async function withVendorScope<T>(
  ctx: { orgId: string; vendorUserId: string },
  fn: (tx: ScopedDB) => Promise<T>,
): Promise<T> {
  return withScope(
    { orgId: ctx.orgId, actorType: "vendor", vendorUserId: ctx.vendorUserId },
    fn,
  );
}

/**
 * Tenant-scoped variant. Caller resolves tenant session via cookie.
 */
export async function withTenantScope<T>(
  ctx: { orgId: string; tenantUserId: string },
  fn: (tx: ScopedDB) => Promise<T>,
): Promise<T> {
  return withScope(
    { orgId: ctx.orgId, actorType: "tenant", tenantUserId: ctx.tenantUserId },
    fn,
  );
}

// SET LOCAL takes a SQL identifier, not a parameter — escape single quotes.
function escapeLiteral(v: string): string {
  return v.replace(/'/g, "''");
}
