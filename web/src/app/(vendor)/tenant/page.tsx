import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { withTenantScope } from "@/lib/server/db";
import { tenantUsers, tenantInsurancePolicies } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import { and, desc, eq } from "drizzle-orm";
import type { ComplianceStatus } from "@contracts/compliance";
import { recordTenantInsuranceFromPortalAction } from "./_actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<ComplianceStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  expiring: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
  superseded: "bg-neutral-200 text-neutral-500",
};

export default async function TenantHome() {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/invalid");

  const data = await withTenantScope(session, async (tx) => {
    const me = await tx
      .select({
        id: tenantUsers.id,
        name: tenantUsers.name,
        email: tenantUsers.email,
        unitId: tenantUsers.unitId,
        unitLabel: units.label,
        propertyName: properties.name,
      })
      .from(tenantUsers)
      .leftJoin(units, eq(units.id, tenantUsers.unitId))
      .leftJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(tenantUsers.id, session.tenantUserId))
      .limit(1);

    const policies = await tx
      .select()
      .from(tenantInsurancePolicies)
      .where(
        and(
          eq(tenantInsurancePolicies.orgId, session.orgId),
          eq(tenantInsurancePolicies.tenantUserId, session.tenantUserId),
        ),
      )
      .orderBy(desc(tenantInsurancePolicies.createdAt));

    return { me: me[0] ?? null, policies };
  });

  const active = data.policies.find((p) => p.status === "active" || p.status === "expiring");

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">
          {data.me?.propertyName ?? "Tenant portal"}
        </h1>
        {data.me?.unitLabel && (
          <p className="text-sm text-neutral-500">Unit {data.me.unitLabel}</p>
        )}
        <p className="mt-1 text-xs text-neutral-500">
          {data.me?.name ?? data.me?.email ?? "Signed in"}
        </p>
      </header>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Renter&apos;s insurance
          </h2>
          {active && (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                STATUS_PILL[active.status as ComplianceStatus]
              }`}
            >
              {active.status}
            </span>
          )}
        </div>

        {active ? (
          <div className="rounded border border-neutral-200 bg-white p-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-2 text-xs">
              <dt>policy</dt>
              <dd>{active.policyNumber ?? "—"}</dd>
              <dt>carrier</dt>
              <dd>{active.carrier ?? "—"}</dd>
              <dt>expires</dt>
              <dd>
                {active.expiresAt ? new Date(active.expiresAt).toLocaleDateString() : "—"}
              </dd>
            </dl>
          </div>
        ) : (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            No active policy on file. Add one below.
          </p>
        )}

        <form
          action={recordTenantInsuranceFromPortalAction}
          className="mt-3 space-y-2 rounded border border-dashed border-neutral-300 bg-white p-3 text-sm"
        >
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Add or renew policy
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="policyNumber"
              placeholder="Policy number"
              className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <input
              name="carrier"
              placeholder="Carrier"
              className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <input
              name="effectiveAt"
              type="date"
              className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <input
              name="expiresAt"
              type="date"
              className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
          >
            Save policy
          </button>
        </form>
      </section>
    </main>
  );
}
