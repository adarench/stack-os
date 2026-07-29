import "server-only";
import { authEvents } from "@db/schema/auth-infra";
import { withScope } from "./db";
import { logger } from "./logger";

export type AuthEventKind =
  | "login_ok"
  | "login_failed"
  | "login_locked"
  | "reset_requested"
  | "reset_completed"
  | "password_changed"
  | "role_changed"
  | "account_deactivated"
  | "account_reactivated"
  | "invitation_issued"
  | "provisioned";

/**
 * Record a security-relevant auth event. **Never** pass passwords, tokens, or
 * hashes — only the kind, who/what, and non-secret metadata. Best-effort: audit
 * must never block or fail the auth action.
 */
export async function recordAuthEvent(e: {
  event: AuthEventKind;
  orgId?: string | null;
  actorType?: "user" | "tenant" | "system";
  subjectUserId?: string | null;
  subjectTenantUserId?: string | null;
  subjectEmail?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await withScope({ orgId: e.orgId ?? "_", actorType: "system" }, (tx) =>
      tx.insert(authEvents).values({
        orgId: e.orgId ?? null,
        event: e.event,
        actorType: e.actorType ?? "system",
        subjectUserId: e.subjectUserId ?? null,
        subjectTenantUserId: e.subjectTenantUserId ?? null,
        subjectEmail: e.subjectEmail ? e.subjectEmail.toLowerCase() : null,
        ip: e.ip ?? null,
        meta: (e.meta ?? null) as never,
      }),
    );
  } catch (err) {
    logger.warn("authevent.error", { event: e.event, err });
  }
}
