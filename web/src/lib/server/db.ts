import "server-only";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, type DB } from "@db/client";
import { auth } from "@clerk/nextjs/server";

export type ScopedDB = Parameters<Parameters<DB["transaction"]>[0]>[0];

type ActorType = "user" | "vendor" | "system" | "inngest";

interface ScopeOpts {
  orgId: string;
  actorType?: ActorType;
  vendorUserId?: string;
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
    // Drop privileges to the RLS-enforced role for the duration of this tx.
    // The owner role has BYPASSRLS; without SET LOCAL ROLE the policies are
    // silently ignored and tenant isolation breaks.
    await tx.execute(sql.raw(`set local role app_user`));
    await tx.execute(sql.raw(`set local app.org_id = '${escapeLiteral(opts.orgId)}'`));
    await tx.execute(sql.raw(`set local app.actor_type = '${escapeLiteral(actorType)}'`));
    if (opts.vendorUserId) {
      await tx.execute(
        sql.raw(`set local app.vendor_user_id = '${escapeLiteral(opts.vendorUserId)}'`),
      );
    }
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

// SET LOCAL takes a SQL identifier, not a parameter — escape single quotes.
function escapeLiteral(v: string): string {
  return v.replace(/'/g, "''");
}
