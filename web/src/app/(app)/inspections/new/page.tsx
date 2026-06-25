import { listProperties, listUnits } from "@/lib/server/properties";
import { listChecklistTemplates } from "@/lib/server/checklists";
import { INSPECTION_KINDS } from "@contracts/state-machines/inspection";
import { Page, PageHeader } from "@/components/ui/page";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createInspectionAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  const [properties, units, templates] = await Promise.all([
    listProperties(),
    listUnits(),
    listChecklistTemplates(),
  ]);

  return (
    <Page width="narrow">
      <PageHeader title="New inspection" backHref="/inspections" />
      <form action={createInspectionAction} className="space-y-3">
        <Field label="Kind" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="ad_hoc">
            {INSPECTION_KINDS.map((k) => (
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
        {templates.length > 0 && (
          <Field label="Start from checklist" htmlFor="checklistTemplateId">
            <Select id="checklistTemplateId" name="checklistTemplateId" defaultValue="">
              <option value="">— none —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.items.length} items)
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>
        <Button type="submit" className="w-full">
          Start inspection
        </Button>
      </form>
    </Page>
  );
}
