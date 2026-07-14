import { listProperties, listUnits, listTenants } from "@/lib/server/properties";
import { Page, PageHeader } from "@/components/ui/page";
import { ServiceRequestForm } from "@/components/operator/service-request-form";

export const dynamic = "force-dynamic";

export default async function NewServiceRequestPage() {
  const [properties, units, tenants] = await Promise.all([
    listProperties(),
    listUnits(),
    listTenants(),
  ]);

  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="Service request"
        title="Log a request"
        backHref="/work"
        description="For a resident request that came in by phone or email."
      />
      <ServiceRequestForm
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        units={units.map((u) => ({ id: u.id, label: u.label, propertyId: u.propertyId }))}
        tenants={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          unitId: t.unitId,
        }))}
      />
    </Page>
  );
}
