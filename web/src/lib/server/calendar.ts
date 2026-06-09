import "server-only";
import { and, eq, gte, lt, isNull } from "drizzle-orm";
import { parseExpression } from "cron-parser";
import { taskTemplates } from "@db/schema/task-templates";
import { inspections } from "@db/schema/inspections";
import { workOrders } from "@db/schema/work-orders";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { withStaffScope } from "./db";

/**
 * Calendar v0 — an agenda of what's coming. Three sources, one timeline:
 *   1. recurring task templates  → projected fire times (the Trello-trust
 *      payload: the team SEES the weekly walk will fire)
 *   2. scheduled inspections     → by scheduled_for
 *   3. open work orders          → by due_at
 *
 * Read-only. Grouped by calendar day. Reuses cron-parser the same way
 * templates.ts does. Editing schedules stays in /admin/templates for now.
 */

export type CalendarKind = "recurring" | "inspection" | "work_order";

export interface CalendarItem {
  /** yyyy-mm-dd grouping key (UTC date of `at`). */
  day: string;
  at: string; // ISO datetime
  kind: CalendarKind;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface CalendarDay {
  day: string;
  items: CalendarItem[];
}

const WINDOW_DAYS = 30;
const MAX_OCCURRENCES_PER_TEMPLATE = 31;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadCalendar(
  now: Date = new Date(),
  windowDays: number = WINDOW_DAYS,
): Promise<CalendarDay[]> {
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  return withStaffScope(async (tx, ctx) => {
    const orgId = ctx.orgId;

    const [templates, insRows, woRows] = await Promise.all([
      tx
        .select({
          id: taskTemplates.id,
          name: taskTemplates.name,
          cron: taskTemplates.cron,
          timezone: taskTemplates.timezone,
          defaultTitle: taskTemplates.defaultTitle,
        })
        .from(taskTemplates)
        .where(
          and(eq(taskTemplates.orgId, orgId), eq(taskTemplates.isActive, true)),
        ),
      tx
        .select({
          id: inspections.id,
          kind: inspections.kind,
          scheduledFor: inspections.scheduledFor,
          propertyName: properties.name,
          unitLabel: units.label,
        })
        .from(inspections)
        .leftJoin(properties, eq(properties.id, inspections.propertyId))
        .leftJoin(units, eq(units.id, inspections.unitId))
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.status, "scheduled"),
            gte(inspections.scheduledFor, now),
            lt(inspections.scheduledFor, windowEnd),
          ),
        ),
      tx
        .select({
          id: workOrders.id,
          number: workOrders.number,
          title: workOrders.title,
          dueAt: workOrders.dueAt,
          propertyName: properties.name,
          unitLabel: units.label,
        })
        .from(workOrders)
        .leftJoin(properties, eq(properties.id, workOrders.propertyId))
        .leftJoin(units, eq(units.id, workOrders.unitId))
        .where(
          and(
            eq(workOrders.orgId, orgId),
            gte(workOrders.dueAt, now),
            lt(workOrders.dueAt, windowEnd),
          ),
        ),
    ]);

    const items: CalendarItem[] = [];

    // 1. Recurring template occurrences within the window.
    for (const t of templates) {
      try {
        const it = parseExpression(t.cron, {
          currentDate: now,
          endDate: windowEnd,
          tz: t.timezone,
        });
        let count = 0;
        while (count < MAX_OCCURRENCES_PER_TEMPLATE) {
          let next: Date;
          try {
            next = it.next().toDate();
          } catch {
            break; // past endDate
          }
          items.push({
            day: dayKey(next),
            at: next.toISOString(),
            kind: "recurring",
            title: t.defaultTitle || t.name,
            subtitle: "Recurring",
            href: "/admin/templates",
          });
          count++;
        }
      } catch {
        // Malformed cron — skip rather than break the whole calendar.
      }
    }

    // 2. Scheduled inspections.
    for (const r of insRows) {
      if (!r.scheduledFor) continue;
      items.push({
        day: dayKey(r.scheduledFor),
        at: r.scheduledFor.toISOString(),
        kind: "inspection",
        title: `${capitalize(r.kind.replace(/_/g, " "))} inspection`,
        subtitle: locationLabel(r.propertyName, r.unitLabel),
        href: `/inspections/${r.id}`,
      });
    }

    // 3. Work orders due in the window.
    for (const r of woRows) {
      if (!r.dueAt) continue;
      items.push({
        day: dayKey(r.dueAt),
        at: r.dueAt.toISOString(),
        kind: "work_order",
        title: r.title,
        subtitle: locationLabel(r.propertyName, r.unitLabel),
        href: `/work-orders/${r.id}`,
      });
    }

    // Group by day, sorted ascending; items within a day sorted by time.
    const byDay = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const arr = byDay.get(item.day) ?? [];
      arr.push(item);
      byDay.set(item.day, arr);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayItems]) => ({
        day,
        items: dayItems.sort((a, b) => a.at.localeCompare(b.at)),
      }));
  });
}

function locationLabel(
  property: string | null,
  unit: string | null,
): string | null {
  if (property && unit) return `${property} · ${unit}`;
  return property ?? unit ?? null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
