import { NextResponse, type NextRequest } from "next/server";
import { loadEntityDetail } from "@/lib/server/entity-detail";

/**
 * Single-entity detail loader for the EntityDrawer.
 *
 *   GET /api/me/entity?ref=WO-1043
 *   GET /api/me/entity?ref=INS-ABC123
 *   GET /api/me/entity?ref=PRJ-ABC123
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "ref required" }, { status: 400 });
  }
  const detail = await loadEntityDetail(ref);
  if (!detail) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
