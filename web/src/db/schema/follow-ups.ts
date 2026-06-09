import { pgEnum, pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { id, orgId, timestamps, polymorphicTargetEnum } from "./_shared";

/**
 * Follow-ups — the thin Trello/email/text replacement. NOT a task manager.
 * A follow-up is "something a human needs to chase that isn't a status change":
 * a Trello card, an email/text reminder, a manual note — optionally attached to
 * a work order / vendor / unit. It exists so the morning triage loop can show
 * "what would otherwise fall through the cracks" in one place.
 */

export const followUpSourceEnum = pgEnum("follow_up_source", [
  "trello",
  "email",
  "text",
  "appfolio",
  "manual",
]);

export const followUpStatusEnum = pgEnum("follow_up_status", [
  "open",
  "snoozed",
  "done",
]);

export const followUps = pgTable(
  "follow_ups",
  {
    id: id(),
    orgId: orgId(),
    /** Optional link to a work order / vendor / unit / project. */
    targetType: polymorphicTargetEnum("target_type"),
    targetId: uuid("target_id"),
    title: text("title").notNull(),
    sourceChannel: followUpSourceEnum("source_channel").notNull().default("manual"),
    /** Deep link back to the source (e.g. the Trello card URL). */
    sourceUrl: text("source_url"),
    /** Stable id from the source system — used for idempotent import. */
    externalId: text("external_id"),
    ownerUserId: uuid("owner_user_id"),
    /** When this should resurface (due / snooze-until). Null = always open. */
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),
    status: followUpStatusEnum("status").notNull().default("open"),
    /** The recommended next move, e.g. "Text Northstar for ETA". */
    nextAction: text("next_action"),
    lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("follow_ups_org_idx").on(t.orgId),
    statusIdx: index("follow_ups_status_idx").on(t.orgId, t.status),
    targetIdx: index("follow_ups_target_idx").on(t.targetType, t.targetId),
    externalIdx: index("follow_ups_external_idx").on(t.orgId, t.externalId),
  }),
);
