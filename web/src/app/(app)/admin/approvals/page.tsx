import Link from "next/link";
import { listPendingApprovals } from "@/lib/server/approvals";
import { decideApprovalAction } from "./_actions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const rows = await listPendingApprovals();
  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Pending approvals</h1>
        <span className="ml-auto text-xs text-neutral-500">{rows.length} pending</span>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing waiting on approval.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li
              key={a.id}
              className="rounded border border-neutral-200 bg-white p-3 text-sm"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-neutral-500">{a.reason}</span>
                <span className="ml-auto font-mono text-sm">
                  ${(Number(a.amountCents ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              {a.notes && (
                <p className="mt-1 text-xs text-neutral-700">{a.notes}</p>
              )}
              <div className="mt-2 flex gap-2">
                <form action={decideApprovalAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="to" value="approved" />
                  <button
                    type="submit"
                    className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Approve
                  </button>
                </form>
                <form action={decideApprovalAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="to" value="rejected" />
                  <button
                    type="submit"
                    className="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
