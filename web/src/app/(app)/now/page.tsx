import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * `/now` — the former "pressure command center" — is paused. The product is
 * re-centered on concrete maintenance execution, so the home surface is now
 * `/my` (the technician's own work). The pressure lanes and their derived
 * readers (queue.ts, consequences.ts, turn-status.ts) are kept in the tree
 * and can be revived as an optional manager lens once the team lives in the
 * execution surfaces. Until then, this route forwards to My Work.
 */
export default async function NowPage() {
  redirect("/my");
}
