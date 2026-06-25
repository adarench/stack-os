import Link from "next/link";
import { listVendors, listVendorUsersForVendor } from "@/lib/server/vendors";
import { createVendorAction, inviteVendorUserAction } from "../_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const vendors = await listVendors();
  const usersByVendor = new Map<string, Awaited<ReturnType<typeof listVendorUsersForVendor>>>();
  for (const v of vendors) {
    usersByVendor.set(v.id, await listVendorUsersForVendor(v.id));
  }

  return (
    <Page width="default">
      <PageHeader title="Vendors" backHref="/work" />

      <Panel className="mb-6">
        <SectionHeading>Add vendor</SectionHeading>
        <form action={createVendorAction} className="grid grid-cols-2 gap-2">
          <Input required name="name" placeholder="Name" className="col-span-2" />
          <Input
            name="trade"
            placeholder="Trade (plumbing, etc.)"
            className="col-span-2"
          />
          <Input name="primaryContactName" placeholder="Contact" />
          <Input name="primaryEmail" type="email" placeholder="Email" />
          <Input name="primaryPhone" placeholder="Phone" className="col-span-2" />
          <Button type="submit" className="col-span-2 mt-1">
            Add vendor
          </Button>
        </form>
      </Panel>

      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {vendors.map((v) => (
            <li key={v.id} className="px-2 py-2.5 text-body">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-foreground">{v.name}</h3>
                <span className="text-label text-muted-foreground">{v.trade ?? ""}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {(usersByVendor.get(v.id) ?? []).map((u) => (
                  <li key={u.id} className="flex items-center gap-2 text-foreground">
                    <span>· {u.name ?? u.email}</span>
                    <Badge tone={toneForStatus(u.status)}>{u.status}</Badge>
                  </li>
                ))}
              </ul>
              <details className="mt-2">
                <summary className="cursor-pointer text-label text-muted-foreground">
                  + invite vendor user
                </summary>
                <form action={inviteVendorUserAction} className="mt-2 grid grid-cols-2 gap-2">
                  <input type="hidden" name="vendorId" value={v.id} />
                  <Input
                    required
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="col-span-2"
                  />
                  <Input name="name" placeholder="Name" />
                  <Input name="phone" placeholder="Phone" />
                  <Button type="submit" size="sm" className="col-span-2">
                    Send magic link
                  </Button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
