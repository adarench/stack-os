import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { inspections } from "@db/schema/inspections";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import {
  INSPECTION_STATUSES,
  type InspectionStatus,
} from "@contracts/state-machines/inspection";
import { withStaffScope } from "./db";

/** Card shape for the inspection board — enriched with building/unit labels. */
export interface BoardInspection {
  id: string;
  kind: string;
  status: InspectionStatus;
  scheduledFor: string | null;
  createdAt: string;
  propertyName: string | null;
  unitLabel: string | null;
}

/** Board columns, in order. `cancelled` is terminal and not shown as a column
 *  (cards moved there simply leave the board). */
export const DEFAULT_INSPECTION_COLUMNS: InspectionStatus[] = [
  "scheduled",
  "in_progress",
  "completed",
  "reviewed",
];

export function emptyInspectionBoard(): Record<InspectionStatus, BoardInspection[]> {
  const out = {} as Record<InspectionStatus, BoardInspection[]>;
  for (const s of INSPECTION_STATUSES) out[s] = [];
  return out;
}

/** Group a flat list of inspection cards by status. Pure helper (test-friendly). */
export function groupInspectionsByStatus(
  rows: BoardInspection[],
): Record<InspectionStatus, BoardInspection[]> {
  const out = emptyInspectionBoard();
  for (const r of rows) out[r.status].push(r);
  return out;
}

export interface InspectionBoardData {
  byStatus: Record<InspectionStatus, BoardInspection[]>;
  total: number;
}

/** Board reader — active inspections (excludes cancelled) grouped by status. */
export async function loadInspectionBoard(): Promise<InspectionBoardData> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: inspections.id,
        kind: inspections.kind,
        status: inspections.status,
        scheduledFor: inspections.scheduledFor,
        createdAt: inspections.createdAt,
        propertyName: properties.name,
        unitLabel: units.label,
      })
      .from(inspections)
      .leftJoin(properties, eq(properties.id, inspections.propertyId))
      .leftJoin(units, eq(units.id, inspections.unitId))
      .where(
        and(
          eq(inspections.orgId, ctx.orgId),
          inArray(inspections.status, [...DEFAULT_INSPECTION_COLUMNS]),
        ),
      )
      .orderBy(desc(inspections.createdAt))
      .limit(500);

    const cards = rows.map(
      (r): BoardInspection => ({
        id: r.id,
        kind: r.kind,
        status: r.status as InspectionStatus,
        scheduledFor: r.scheduledFor ? r.scheduledFor.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        propertyName: r.propertyName,
        unitLabel: r.unitLabel,
      }),
    );

    return { byStatus: groupInspectionsByStatus(cards), total: cards.length };
  });
}
