import { NextResponse, type NextRequest } from "next/server";
import { loadInbox, loadInboxSummary } from "@/lib/server/inbox";

/**
 * Inbox + bell badge. v1 returns the staff user's last N notifications and
 * a coarse unread approximation (delivered in last 24h). A per-user
 * `read_at` column on the notifications table lands when product validates
 * the inbox surface — defer until then.
 *
 *   GET /api/me/notifications              → { items, summary }
 *   GET /api/me/notifications?summary=1    → summary only (bell badge)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("summary") === "1") {
    const summary = await loadInboxSummary();
    return NextResponse.json(summary);
  }
  const items = await loadInbox(50);
  const summary = await loadInboxSummary();
  return NextResponse.json({ items, summary });
}
