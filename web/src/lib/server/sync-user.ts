import "server-only";
import { withStaffScope } from "./db";
import { ensureUserRow } from "./ensure-user";

// Re-export so existing call sites (`@/lib/server/sync-user`) keep working.
// The implementation moved to ./ensure-user to break a db.ts ↔ sync-user cycle.
export { ensureUserRow };

/**
 * Ensure a `users` row exists for the current operator in the active org and
 * return its internal id. The row is already provisioned by withStaffScope on
 * request entry, so this resolves to the existing row.
 */
export async function ensureCurrentUser(): Promise<string> {
  return withStaffScope(async (tx, ctx) =>
    ensureUserRow(tx, ctx.orgId, ctx.userId),
  );
}
