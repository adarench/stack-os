import { NextResponse } from "next/server";
import { listAssignableTechnicians } from "@/lib/server/properties";

/**
 * Technicians assignable from the drawer's "Assign to technician" menu.
 *
 *   GET /api/me/technicians
 */
export async function GET() {
  const items = await listAssignableTechnicians();
  return NextResponse.json({ items });
}
