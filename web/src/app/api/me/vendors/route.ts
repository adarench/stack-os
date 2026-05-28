import { NextResponse } from "next/server";
import { listAssignableVendorUsers } from "@/lib/server/vendors";

/**
 * Vendor users assignable from the drawer. Joined with vendor + COI status.
 * Returned as flat array; client groups by vendor for the select UI.
 *
 *   GET /api/me/vendors
 */
export async function GET() {
  const items = await listAssignableVendorUsers();
  return NextResponse.json({ items });
}
