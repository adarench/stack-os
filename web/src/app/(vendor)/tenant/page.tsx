import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { withTenantScope } from "@/lib/server/db";
import { tenantUsers, tenantInsurancePolicies } from "@db/schema/compliance";
import { units } from "@db/schema/units";
import { properties } from "@db/schema/properties";
import { and, desc, eq } from "drizzle-orm";
import type { ComplianceStatus } from "@contracts/compliance";
import { recordTenantInsuranceFromPortalAction } from "./_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

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
    <Page as="main" width="narrow">
      <PageHeader
        title={data.me?.propertyName ?? "Tenant portal"}
        eyebrow={data.me?.unitLabel ? `Unit ${data.me.unitLabel}` : undefined}
        description={data.me?.name ?? data.me?.email ?? "Signed in"}
      />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionHeading className="mb-0">Renter&apos;s insurance</SectionHeading>
          {active && (
            <Badge tone={toneForStatus(active.status as ComplianceStatus)}>
              {(active.status as string).replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        {active ? (
          <Panel>
            <dl className="grid grid-cols-2 gap-x-2 text-label">
              <dt className="text-muted-foreground">Policy</dt>
              <dd className="text-foreground">{active.policyNumber ?? "—"}</dd>
              <dt className="text-muted-foreground">Carrier</dt>
              <dd className="text-foreground">{active.carrier ?? "—"}</dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="text-foreground">
                {active.expiresAt ? new Date(active.expiresAt).toLocaleDateString() : "—"}
              </dd>
            </dl>
          </Panel>
        ) : (
          <p className="rounded-md border border-urgency-blocked/30 bg-urgency-blocked/12 p-3 text-body text-foreground">
            No active policy on file. Add one below.
          </p>
        )}

        <Panel className="mt-3 space-y-2">
          <form action={recordTenantInsuranceFromPortalAction} className="space-y-2">
            <SectionHeading className="mb-0">Add or renew policy</SectionHeading>
            <div className="grid grid-cols-2 gap-2">
              <Input name="policyNumber" placeholder="Policy number" />
              <Input name="carrier" placeholder="Carrier" />
              <Input name="effectiveAt" type="date" />
              <Input name="expiresAt" type="date" />
            </div>
            <Button type="submit" className="w-full">
              Save policy
            </Button>
          </form>
        </Panel>
      </section>
    </Page>
  );
}
