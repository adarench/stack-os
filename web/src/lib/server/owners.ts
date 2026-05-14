import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { assignments } from "@db/schema/assignments";
import { users } from "@db/schema/users";
import { vendors } from "@db/schema/vendors";
import { vendorUsers } from "@db/schema/vendor-users";
import type { ScopedDB } from "./db";
import type { PolymorphicTarget } from "@contracts/polymorphic";

/**
 * Resolves the most-recent active assignee per target into a display name.
 * One scoped query joins users + vendors + vendor_users — only the column
 * matching the active row's assignee_type is non-null. First row wins per
 * target (sorted by assigned_at DESC), which matches the dispatcher's mental
 * model of "who picked this up last."
 */
export async function loadActiveOwners(
  tx: ScopedDB,
  orgId: string,
  targetType: PolymorphicTarget,
  targetIds: string[],
): Promise<Map<string, string>> {
  if (targetIds.length === 0) return new Map();

  const rows = await tx
    .select({
      targetId: assignments.targetId,
      assignedAt: assignments.assignedAt,
      userName: users.name,
      userEmail: users.email,
      vendorName: vendors.name,
      vendorUserName: vendorUsers.name,
      vendorUserEmail: vendorUsers.email,
    })
    .from(assignments)
    .leftJoin(
      users,
      and(
        eq(users.id, assignments.assigneeId),
        eq(assignments.assigneeType, "user"),
      ),
    )
    .leftJoin(
      vendors,
      and(
        eq(vendors.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor"),
      ),
    )
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, targetType),
        inArray(assignments.targetId, targetIds),
        isNull(assignments.unassignedAt),
      ),
    )
    .orderBy(desc(assignments.assignedAt));

  const out = new Map<string, string>();
  for (const r of rows) {
    if (out.has(r.targetId)) continue;
    const name =
      r.userName ??
      r.vendorName ??
      r.vendorUserName ??
      r.userEmail ??
      r.vendorUserEmail ??
      null;
    if (name) out.set(r.targetId, name);
  }
  return out;
}
