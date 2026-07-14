import { exportVendorsCsv } from "@/lib/server/exports";

export const dynamic = "force-dynamic";

const ESCAPE = (v: string | null | number | undefined) => {
  if (v == null) return "";
  const s = String(v);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export async function GET() {
  const rows = await exportVendorsCsv();
  const header = ["vendor", "assigned", "completed", "coi_state"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.assigned, r.completed, r.coiState].map(ESCAPE).join(","));
  }
  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendors-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
