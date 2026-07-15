import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { withTenantScope } from "@/lib/server/db";
import { tenantInsurancePolicies } from "@db/schema/compliance";
import { and, desc, eq } from "drizzle-orm";
import type { ComplianceStatus } from "@contracts/compliance";
import { recordTenantInsuranceFromPortalAction } from "../_actions";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Input, Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Renter's insurance — relocated out of the tenant home so the home is the
 * repair surface. Same form + server action as before.
 */
export default async function TenantInsurancePage() {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/sign-in");

  const policies = await withTenantScope(session, async (tx) =>
    tx
      .select()
      .from(tenantInsurancePolicies)
      .where(
        and(
          eq(tenantInsurancePolicies.orgId, session.orgId),
          eq(tenantInsurancePolicies.tenantUserId, session.tenantUserId),
        ),
      )
      .orderBy(desc(tenantInsurancePolicies.createdAt)),
  );
  const active = policies.find((p) => p.status === "active" || p.status === "expiring");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Renter&apos;s insurance
        </h1>
        {active && (
          <Badge tone={toneForStatus(active.status as ComplianceStatus)}>
            {(active.status as string).replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      {active ? (
        <Panel>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-label">
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

      <Panel className="mt-4">
        <form action={recordTenantInsuranceFromPortalAction} className="space-y-3">
          <SectionHeading className="mb-0">Add or renew policy</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Policy number" className="col-span-2">
              <Input name="policyNumber" placeholder="Policy number" />
            </Field>
            <Field label="Carrier" className="col-span-2">
              <Input name="carrier" placeholder="Carrier" />
            </Field>
            <Field label="Effective">
              <Input name="effectiveAt" type="date" />
            </Field>
            <Field label="Expires">
              <Input name="expiresAt" type="date" />
            </Field>
          </div>
          <Button type="submit" className="h-11 w-full">
            Save policy
          </Button>
        </form>
      </Panel>
    </div>
  );
}
