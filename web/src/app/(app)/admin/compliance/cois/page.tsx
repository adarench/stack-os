import Link from "next/link";
import { listCois } from "@/lib/server/coi";
import { listVendors } from "@/lib/server/vendors";
import type { ComplianceStatus } from "@contracts/compliance";
import { recordCoiAction } from "../_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function CoisPage() {
  const [cois, vendors] = await Promise.all([listCois(), listVendors()]);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return (
    <Page width="default">
      <PageHeader
        title="Vendor COIs"
        backHref="/work"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/compliance/tenants">Tenant insurance</Link>
          </Button>
        }
      />

      <Panel className="mb-6">
        <SectionHeading>Record a COI</SectionHeading>
        <form action={recordCoiAction} className="grid grid-cols-2 gap-2">
          <Select required name="vendorId" className="col-span-2">
            <option value="">— select vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <Input name="policyNumber" placeholder="Policy number" />
          <Input name="carrier" placeholder="Carrier" />
          <Input
            name="coverageAmountCents"
            type="number"
            min={0}
            placeholder="Coverage (¢)"
          />
          <Input name="effectiveAt" type="date" />
          <Input name="expiresAt" type="date" className="col-span-2" />
          <Textarea name="notes" rows={2} placeholder="Notes" className="col-span-2" />
          <Button type="submit" className="col-span-2">
            Record COI
          </Button>
        </form>
      </Panel>

      {cois.length === 0 ? (
        <EmptyState title="No COIs recorded yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {cois.map((c) => {
            const v = vendorById.get(c.vendorId);
            return (
              <li key={c.id} className="px-2 py-2.5 text-body hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {v?.name ?? "(unknown vendor)"}
                  </span>
                  <Badge tone={toneForStatus(c.status)} className="ml-auto">
                    {(c.status as ComplianceStatus).replace(/_/g, " ")}
                  </Badge>
                </div>
                <dl className="mt-1 grid grid-cols-2 gap-x-2 text-label text-muted-foreground">
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
    </Page>
  );
}
