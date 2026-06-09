import "server-only";
import { and, eq, ilike, or, sql as drizzleSql, desc } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import { withStaffScope } from "./db";
import { parseWoNumber, searchPattern } from "./work-orders";

/**
 * ⌘K entity typeahead. Returns at most `limit` matching entities across
 * work_orders + inspections + projects, RLS-scoped to the operator's org.
 *
 * Matching:
 *   - "WO-1043" or "1043" → exact ref hit on work_orders.number
 *   - free text → title ILIKE pattern across all three entity types
 *
 * Results are merged client-side; refs are stable enough to dedupe on.
 */
export interface SearchHit {
  ref: string;
  type: "wo" | "ins" | "prj" | "unit";
  title: string;
  property: string | null;
  unit: string | null;
}

const LIMIT = 8;

export async function searchEntities(
  q: string,
  limit: number = LIMIT,
): Promise<SearchHit[]> {
  const trimmed = q.trim();
  if (trimmed.length < 1) return [];

  return withStaffScope(async (tx, ctx) => {
    const woNumber = parseWoNumber(trimmed);
    const pattern = searchPattern(trimmed);

    // WO ref exact match always wins — return immediately so the typeahead
    // shows the exact entity at the top.
    if (woNumber !== null) {
      const exact = await tx
        .select({
          id: workOrders.id,
          number: workOrders.number,
          title: workOrders.title,
        })
        .from(workOrders)
        .where(
          and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.number, woNumber)),
        )
        .limit(1);
      if (exact.length > 0) {
        const r = exact[0]!;
        return [
          {
            ref: `WO-${r.number}`,
            type: "wo",
            title: r.title,
            property: null,
            unit: null,
          },
        ];
      }
    }

    if (!pattern) return [];

    // Fan out four lightweight searches; merge and cap. Units are the spine —
    // searchable by their own label or their property name so "Maple #2" or
    // "247 Maple" both surface the unit.
    const [wos, inss, prjs, unts] = await Promise.all([
      tx
        .select({
          ref: drizzleSql<string>`'WO-' || ${workOrders.number}::text`,
          title: workOrders.title,
          updatedAt: workOrders.updatedAt,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.orgId, ctx.orgId),
            ilike(workOrders.title, pattern),
          ),
        )
        .orderBy(desc(workOrders.updatedAt))
        .limit(limit),
      tx
        .select({
          ref: drizzleSql<string>`'INS-' || left(${inspections.id}::text, 6)`,
          title: drizzleSql<string>`coalesce(${inspections.kind}::text, 'inspection')`,
          updatedAt: inspections.updatedAt,
        })
        .from(inspections)
        .where(
          and(
            eq(inspections.orgId, ctx.orgId),
            or(
              ilike(inspections.kind, pattern),
              // inspections don't have a single title column — fall back to
              // kind. Cheap match for "move-in", "move-out", "annual".
            ),
          ),
        )
        .orderBy(desc(inspections.updatedAt))
        .limit(limit),
      tx
        .select({
          ref: drizzleSql<string>`'PRJ-' || left(${projects.id}::text, 6)`,
          title: projects.name,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .where(
          and(
            eq(projects.orgId, ctx.orgId),
            ilike(projects.name, pattern),
          ),
        )
        .orderBy(desc(projects.updatedAt))
        .limit(limit),
      tx
        .select({
          ref: drizzleSql<string>`'UNT-' || left(${units.id}::text, 6)`,
          label: units.label,
          property: properties.name,
          updatedAt: units.updatedAt,
        })
        .from(units)
        .leftJoin(properties, eq(properties.id, units.propertyId))
        .where(
          and(
            eq(units.orgId, ctx.orgId),
            or(ilike(units.label, pattern), ilike(properties.name, pattern)),
          ),
        )
        .orderBy(desc(units.updatedAt))
        .limit(limit),
    ]);

    const hits: SearchHit[] = [
      ...wos.map(
        (r): SearchHit => ({
          ref: r.ref,
          type: "wo",
          title: r.title,
          property: null,
          unit: null,
        }),
      ),
      ...inss.map(
        (r): SearchHit => ({
          ref: r.ref,
          type: "ins",
          title: `${r.title} inspection`,
          property: null,
          unit: null,
        }),
      ),
      ...prjs.map(
        (r): SearchHit => ({
          ref: r.ref,
          type: "prj",
          title: r.title,
          property: null,
          unit: null,
        }),
      ),
      ...unts.map(
        (r): SearchHit => ({
          ref: r.ref,
          type: "unit",
          title: [r.property, r.label].filter(Boolean).join(" · "),
          property: r.property,
          unit: r.label,
        }),
      ),
    ];

    return hits.slice(0, limit);
  });
}
