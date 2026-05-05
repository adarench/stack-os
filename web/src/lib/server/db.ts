import "server-only";
import { sql } from "drizzle-orm";
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
 * session vars set. Throws if no org is active.
 */
export async function withStaffScope<T>(
  fn: (tx: ScopedDB, ctx: { orgId: string; userId: string }) => Promise<T>,
): Promise<T> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("not_authenticated");
  if (!orgId) throw new Error("no_active_org");
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
