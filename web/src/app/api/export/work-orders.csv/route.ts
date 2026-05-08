import { exportWorkOrdersCsv } from "@/lib/server/dashboard";

export const dynamic = "force-dynamic";

const ESCAPE = (v: string | null | number | Date | undefined) => {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export async function GET() {
  const rows = await exportWorkOrdersCsv();
  const header = [
    "number",
    "title",
    "status",
    "kind",
    "priority",
    "property_id",
    "unit_id",
    "due_at",
    "scheduled_for",
    "started_at",
    "completed_at",
    "created_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.number,
        r.title,
        r.status,
        r.kind,
        r.priority,
        r.propertyId ?? "",
        r.unitId ?? "",
        r.dueAt,
        r.scheduledFor,
        r.startedAt,
        r.completedAt,
        r.createdAt,
      ]
        .map(ESCAPE)
        .join(","),
    );
  }
  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="work-orders-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
