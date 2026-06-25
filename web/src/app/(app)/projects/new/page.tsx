import { listProperties, listUnits } from "@/lib/server/properties";
import { PROJECT_KINDS } from "@contracts/state-machines/project";
import { createProjectAction } from "../_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);
  return (
    <Page width="narrow">
      <PageHeader title="New project" backHref="/projects" />
      <form action={createProjectAction} className="space-y-3">
        <Field label="Name" htmlFor="name">
          <Input required id="name" name="name" maxLength={200} />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" rows={3} />
        </Field>
        <Field label="Kind" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="general">
            {PROJECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, " ")}
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
        <Field label="Budget (cents)" htmlFor="budgetCents">
          <Input
            id="budgetCents"
            name="budgetCents"
            type="number"
            min={0}
            placeholder="optional"
          />
        </Field>
        <Button type="submit" className="w-full">
          Create project
        </Button>
      </form>
    </Page>
  );
}
