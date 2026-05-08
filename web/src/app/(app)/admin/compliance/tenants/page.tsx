import Link from "next/link";
import { listTenantInsurance } from "@/lib/server/tenant-insurance";
import { listUnits } from "@/lib/server/properties";
import { withStaffScope } from "@/lib/server/db";
import { tenantUsers } from "@db/schema/compliance";
import { eq } from "drizzle-orm";
import type { ComplianceStatus } from "@contracts/compliance";
import { inviteTenantUserAction, recordTenantInsuranceAction } from "../_actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<ComplianceStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  expiring: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
  superseded: "bg-neutral-200 text-neutral-500",
};

export default async function TenantInsurancePage() {
  const policies = await listTenantInsurance();
  const units = await listUnits();
  const tenants = await withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.orgId, ctx.orgId)),
  );
  const unitById = new Map(units.map((u) => [u.id, u]));

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Tenant insurance</h1>
        <Link
          href="/admin/compliance/cois"
          className="ml-auto rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
        >
          Vendor COIs
        </Link>
      </header>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Invite tenant
        </h2>
        <form action={inviteTenantUserAction} className="grid grid-cols-2 gap-2 text-sm">
          <select
            required
            name="unitId"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">— select unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <input
            required
            name="email"
            type="email"
            placeholder="Tenant email"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="name"
            placeholder="Name"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="phone"
            placeholder="Phone"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="col-span-2 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Send magic link
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          Invite URL is logged in dev console + sent via Resend.
        </p>
      </section>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Record policy (admin entry)
        </h2>
        <form action={recordTenantInsuranceAction} className="grid grid-cols-2 gap-2 text-sm">
          <select
            required
            name="tenantUserId"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">— select tenant —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? t.email}{" "}
                {t.unitId && `(${unitById.get(t.unitId)?.label ?? "?"})`}
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
            name="effectiveAt"
            type="date"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="expiresAt"
            type="date"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="col-span-2 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Record policy
          </button>
        </form>
      </section>

      {policies.length === 0 ? (
        <p className="text-sm text-neutral-500">No policies recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {policies.map(({ policy, tenantEmail, tenantName }) => (
            <li
              key={policy.id}
              className="rounded border border-neutral-200 bg-white p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{tenantName ?? tenantEmail ?? "(unknown)"}</span>
                <span
                  className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                    STATUS_PILL[policy.status as ComplianceStatus]
                  }`}
                >
                  {policy.status}
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs text-neutral-600">
                <dt>policy</dt>
                <dd>{policy.policyNumber ?? "—"}</dd>
                <dt>carrier</dt>
                <dd>{policy.carrier ?? "—"}</dd>
                <dt>effective</dt>
                <dd>
                  {policy.effectiveAt ? new Date(policy.effectiveAt).toLocaleDateString() : "—"}
                </dd>
                <dt>expires</dt>
                <dd>
                  {policy.expiresAt ? new Date(policy.expiresAt).toLocaleDateString() : "—"}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
