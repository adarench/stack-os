import { pgTable, text, integer, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { id } from "./_shared";

/**
 * DB-backed rate limiter (fixed window). One row per bucket key
 * (e.g. `login:ip:1.2.3.4` or `reset:email:sam@x`). Pre-auth + org-agnostic, so
 * no org_id — accessed under a system scope. Brute-force protection on login +
 * password-reset endpoints (additive to the per-account lockout).
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * Security-relevant authentication events (AUTH audit). Never stores passwords,
 * tokens, or hashes — only the event kind + who/what + non-secret metadata.
 * org_id is nullable (a failed login may resolve no account/org).
 */
export const authEvents = pgTable(
  "auth_events",
  {
    id: id(),
    orgId: text("org_id"),
    event: text("event").notNull(), // login_ok | login_failed | login_locked | reset_requested | reset_completed | password_changed | role_changed | account_deactivated | account_reactivated | provisioned
    actorType: text("actor_type").notNull().default("system"), // who caused it: user | tenant | system
    subjectUserId: uuid("subject_user_id"), // affected staff/tech
    subjectTenantUserId: uuid("subject_tenant_user_id"), // affected resident
    subjectEmail: text("subject_email"), // affected email (may not resolve to a row)
    ip: text("ip"),
    meta: jsonb("meta"), // non-secret extras
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("auth_events_org_idx").on(t.orgId, t.createdAt),
    eventIdx: index("auth_events_event_idx").on(t.event, t.createdAt),
  }),
);
