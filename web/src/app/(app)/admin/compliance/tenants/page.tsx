import Link from "next/link";
import { listTenantInsurance } from "@/lib/server/tenant-insurance";
import { listUnits } from "@/lib/server/properties";
import { withStaffScope } from "@/lib/server/db";
import { tenantUsers } from "@db/schema/compliance";
import { eq } from "drizzle-orm";
import { inviteTenantUserAction, recordTenantInsuranceAction } from "../_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

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
    <Page width="default">
      <PageHeader
        title="Tenant insurance"
        backHref="/work"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/compliance/cois">Vendor COIs</Link>
          </Button>
        }
      />

      <Panel className="mb-6">
        <SectionHeading>Invite tenant</SectionHeading>
        <form action={inviteTenantUserAction} className="grid grid-cols-2 gap-2">
          <Select required name="unitId" className="col-span-2">
            <option value="">— select unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
          <Input
            required
            name="email"
            type="email"
            placeholder="Tenant email"
            className="col-span-2"
          />
          <Input name="name" placeholder="Name" />
          <Input name="phone" placeholder="Phone" />
          <Button type="submit" size="sm" className="col-span-2">
            Send magic link
          </Button>
        </form>
        <p className="mt-2 text-meta text-muted-foreground">
          Invite URL is logged in dev console + sent via Resend.
        </p>
      </Panel>

      <Panel className="mb-6">
        <SectionHeading>Record policy (admin entry)</SectionHeading>
        <form action={recordTenantInsuranceAction} className="grid grid-cols-2 gap-2">
          <Select required name="tenantUserId" className="col-span-2">
            <option value="">— select tenant —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? t.email}{" "}
                {t.unitId && `(${unitById.get(t.unitId)?.label ?? "?"})`}
              </option>
            ))}
          </Select>
          <Input name="policyNumber" placeholder="Policy number" />
          <Input name="carrier" placeholder="Carrier" />
          <Input name="effectiveAt" type="date" />
          <Input name="expiresAt" type="date" />
          <Button type="submit" size="sm" className="col-span-2">
            Record policy
          </Button>
        </form>
      </Panel>

      {policies.length === 0 ? (
        <EmptyState title="No policies recorded yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {policies.map(({ policy, tenantEmail, tenantName }) => (
            <li key={policy.id} className="px-2 py-2.5 text-body hover:bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {tenantName ?? tenantEmail ?? "(unknown)"}
                </span>
                <Badge tone={toneForStatus(policy.status)} className="ml-auto">
                  {policy.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-2 text-meta text-muted-foreground">
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
    </Page>
  );
}
