import Link from "next/link";
import { listCois } from "@/lib/server/coi";
import { listVendors } from "@/lib/server/vendors";
import { getAttachmentReadUrls } from "@/lib/server/attachments";
import type { ComplianceStatus } from "@contracts/compliance";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CoiRecordForm } from "@/components/compliance/coi-record-form";

export const dynamic = "force-dynamic";

export default async function CoisPage() {
  const [cois, vendors] = await Promise.all([listCois(), listVendors()]);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const docs = await getAttachmentReadUrls(cois.map((c) => c.attachmentId));

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
        <CoiRecordForm vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} />
      </Panel>

      {cois.length === 0 ? (
        <EmptyState title="No COIs recorded yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {cois.map((c) => {
            const v = vendorById.get(c.vendorId);
            const doc = c.attachmentId ? docs.get(c.attachmentId) : undefined;
            return (
              <li key={c.id} className="px-2 py-2.5 text-body hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {v?.name ?? "(unknown vendor)"}
                  </span>
                  {doc && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-label text-urgency-inflow hover:underline"
                    >
                      PDF
                    </a>
                  )}
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
