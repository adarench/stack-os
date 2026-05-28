import { NextResponse, type NextRequest } from "next/server";
import { searchEntities } from "@/lib/server/entity-search";

/**
 * ⌘K entity typeahead endpoint. Returns up to 8 matching entities across
 * work_orders + inspections + projects.
 *
 *   GET /api/me/search?q=WO-1043 → exact ref hit
 *   GET /api/me/search?q=leak    → free-text title matches
 *
 * Auth via withStaffScope; unauthenticated callers get 307 → /sign-in.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ hits: [] });
  }
  const hits = await searchEntities(q);
  return NextResponse.json({ hits });
}
