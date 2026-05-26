import Link from "next/link";
import { listCois } from "@/lib/server/coi";
import { listVendors } from "@/lib/server/vendors";
import type { ComplianceStatus } from "@contracts/compliance";
import { recordCoiAction } from "../_actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<ComplianceStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  expiring: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
  superseded: "bg-neutral-200 text-neutral-500",
};

export default async function CoisPage() {
  const [cois, vendors] = await Promise.all([listCois(), listVendors()]);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Vendor COIs</h1>
        <Link
          href="/admin/compliance/tenants"
          className="ml-auto rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
        >
          Tenant insurance
        </Link>
      </header>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Record a COI
        </h2>
        <form action={recordCoiAction} className="grid grid-cols-2 gap-2 text-sm">
          <select
            required
            name="vendorId"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">— select vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input
            name="policyNumber"
            placeholder="Policy number"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="carrier"
            placeholder="Carrier"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="coverageAmountCents"
            type="number"
            min={0}
            placeholder="Coverage (¢)"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="effectiveAt"
            type="date"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="expiresAt"
            type="date"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Notes"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="col-span-2 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Record COI
          </button>
        </form>
      </section>

      {cois.length === 0 ? (
        <p className="text-sm text-neutral-500">No COIs recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {cois.map((c) => {
            const v = vendorById.get(c.vendorId);
            return (
              <li
                key={c.id}
                className="rounded border border-neutral-200 bg-white p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{v?.name ?? "(unknown vendor)"}</span>
                  <span
                    className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                      STATUS_PILL[c.status as ComplianceStatus]
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs text-neutral-600">
                  <dt>policy</dt>
                  <dd>{c.policyNumber ?? "—"}</dd>
                  <dt>carrier</dt>
                  <dd>{c.carrier ?? "—"}</dd>
                  <dt>effective</dt>
                  <dd>{c.effectiveAt ? new Date(c.effectiveAt).toLocaleDateString() : "—"}</dd>
                  <dt>expires</dt>
                  <dd>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
