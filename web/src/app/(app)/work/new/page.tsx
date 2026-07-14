import Link from "next/link";
import { listProperties, listUnits } from "@/lib/server/properties";
import { createWorkOrderAction } from "@/lib/actions/work-orders";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";
import { Page, PageHeader } from "@/components/ui/page";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function action(formData: FormData) {
  "use server";
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  await createWorkOrderAction({
    title: String(formData.get("title")),
    description: String(formData.get("description") ?? "") || undefined,
    priority: (formData.get("priority") as never) ?? "normal",
    propertyId: propertyId || undefined,
    unitId: unitId || undefined,
    kind: "work_order",
  });
}

export default async function NewWorkOrderPage() {
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);

  return (
    <Page width="narrow">
      <PageHeader title="New work order" backHref="/work" />
      <p className="mb-3 text-label text-muted-foreground">
        Logging a resident request?{" "}
        <Link href="/work/new-request" className="text-urgency-inflow hover:underline">
          Use the service request form →
        </Link>
      </p>
      <form action={action} className="space-y-3">
        <Field label="Title" htmlFor="title">
          <Input required id="title" name="title" maxLength={200} />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" rows={4} />
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="normal">
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property" htmlFor="propertyId">
          <Select id="propertyId" name="propertyId">
            <option value="">— none —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" htmlFor="unitId">
          <Select id="unitId" name="unitId">
            <option value="">— none —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="w-full">
          Create
        </Button>
      </form>
    </Page>
  );
}
