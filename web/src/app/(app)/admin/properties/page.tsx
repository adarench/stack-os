import Link from "next/link";
import { listProperties, listUnits, listStaffUsers } from "@/lib/server/properties";
import {
  createPropertyAction,
  createUnitAction,
  setPropertyAssigneeAction,
} from "../_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const [properties, units, staff] = await Promise.all([
    listProperties(),
    listUnits(),
    listStaffUsers(),
  ]);
  const unitsByProperty = new Map<string, typeof units>();
  for (const u of units) {
    const arr = unitsByProperty.get(u.propertyId) ?? [];
    arr.push(u);
    unitsByProperty.set(u.propertyId, arr);
  }

  return (
    <Page width="default">
      <PageHeader title="Properties & units" backHref="/work" />

      <Panel className="mb-6">
        <SectionHeading>Add property</SectionHeading>
        <form action={createPropertyAction} className="grid grid-cols-2 gap-2">
          <Input required name="name" placeholder="Name" className="col-span-2" />
          <Input name="addressLine1" placeholder="Address" className="col-span-2" />
          <Input name="city" placeholder="City" />
          <Input name="state" placeholder="State" />
          <Input name="postalCode" placeholder="ZIP" />
          <Button type="submit" size="sm" className="col-span-2 mt-1">
            Add property
          </Button>
        </form>
      </Panel>

      {properties.length === 0 ? (
        <EmptyState title="No properties yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {properties.map((p) => (
            <li key={p.id} className="px-2 py-2.5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-title font-medium text-foreground">{p.name}</h3>
                <span className="text-label text-muted-foreground">
                  {p.city ?? ""} {p.state ?? ""}
                </span>
              </div>

              {/* Covered by: the tech this building's new work orders auto-route
                  to. Submits on change so there's no extra save button. */}
              <form
                action={setPropertyAssigneeAction}
                className="mt-2 flex items-center gap-2 text-label"
              >
                <input type="hidden" name="propertyId" value={p.id} />
                <label className="text-muted-foreground">Covered by</label>
                <Select
                  name="userId"
                  defaultValue={p.defaultAssigneeUserId ?? ""}
                  className="w-auto"
                >
                  <option value="">— unassigned (no auto-route) —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.email}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline" size="sm">
                  Save
                </Button>
              </form>

              <ul className="mt-2 space-y-1 text-body">
                {(unitsByProperty.get(p.id) ?? []).map((u) => (
                  <li key={u.id} className="text-foreground">
                    · {u.label}
                  </li>
                ))}
              </ul>
              <details className="mt-2">
                <summary className="cursor-pointer text-label text-muted-foreground">
                  + add unit
                </summary>
                <form action={createUnitAction} className="mt-2 grid grid-cols-2 gap-2">
                  <input type="hidden" name="propertyId" value={p.id} />
                  <Input required name="label" placeholder="Unit label" className="col-span-2" />
                  <Input name="bedrooms" placeholder="BR" />
                  <Input name="bathrooms" placeholder="BA" />
                  <Button type="submit" size="sm" className="col-span-2">
                    Add unit
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
