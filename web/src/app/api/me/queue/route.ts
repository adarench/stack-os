import { NextResponse, type NextRequest } from "next/server";
import {
  loadQueueLane,
  loadQueueSummary,
  type QueueLane,
} from "@/lib/server/queue";

const LANES: QueueLane[] = [
  "needs",
  "overdue",
  "blocked",
  "today",
  "inflight",
  "changed",
];

/**
 * Cross-entity operator queue. Powers /now and the bell badge.
 *
 *   GET /api/me/queue?summary=1
 *   GET /api/me/queue?lane=overdue
 *
 * Auth is handled by `loadQueue*` via `withStaffScope` — unauthenticated
 * requests will throw a NEXT_REDIRECT to /sign-in, which Next renders as a
 * 307 for fetches.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (sp.get("summary") === "1") {
    const summary = await loadQueueSummary();
    return NextResponse.json(summary);
  }

  const laneParam = sp.get("lane");
  if (laneParam && LANES.includes(laneParam as QueueLane)) {
    const items = await loadQueueLane(laneParam as QueueLane);
    return NextResponse.json({ items });
  }

  return NextResponse.json(
    { error: "Provide ?summary=1 or ?lane=<needs|overdue|blocked|today|inflight|changed>" },
    { status: 400 },
  );
}
