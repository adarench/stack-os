import "server-only";
import { auditLog } from "@db/schema/audit-log";
import type { PolymorphicTarget, ActorType } from "@contracts/polymorphic";
import type { ScopedDB } from "./db";

interface AuditInput {
  orgId: string;
  targetType: PolymorphicTarget;
  targetId: string;
  action: string;
  actorType?: ActorType;
  actorUserId?: string | null;
  diff?: unknown;
}

export async function writeAudit(tx: ScopedDB, input: AuditInput): Promise<void> {
  await tx.insert(auditLog).values({
    orgId: input.orgId,
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action,
    actorType: input.actorType ?? "user",
    actorUserId: input.actorUserId ?? null,
    diff: (input.diff ?? null) as never,
  });
}
