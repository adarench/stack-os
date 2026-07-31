import { listProperties, listUnits, listAssignableTechnicians } from "@/lib/server/properties";
import { getOrgFallbackAssignee } from "@/lib/server/commercial";
import { setPropertyAssigneeAction, setOrgFallbackAssigneeAction } from "../_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

/**
 * Assignments — the routing source of truth. An admin sees, at a glance, which
 * technician covers each building (and where uncovered requests fall back), and
 * can change coverage inline. Building/unit CRUD stays on "Buildings & units".
 */
export default async function AssignmentsPage() {
  const [properties, units, techs, fallback] = await Promise.all([
    listProperties(),
    listUnits(),
    listAssignableTechnicians(),
    getOrgFallbackAssignee(),
  ]);
  const techName = new Map(techs.map((t) => [t.id, t.name ?? t.email]));
  const unitCount = new Map<string, number>();
  for (const u of units) unitCount.set(u.propertyId, (unitCount.get(u.propertyId) ?? 0) + 1);

  // Group buildings by their covering technician for the "at a glance" view.
  const byTech = new Map<string, string[]>();
  const unassigned: string[] = [];
  for (const p of properties) {
    if (p.defaultAssigneeUserId) {
      const arr = byTech.get(p.defaultAssigneeUserId) ?? [];
      arr.push(p.name);
      byTech.set(p.defaultAssigneeUserId, arr);
    } else {
      unassigned.push(p.name);
    }
  }

  return (
    <Page width="default">
      <PageHeader title="Assignments" backHref="/work" />
      <p className="-mt-2 mb-5 text-body text-muted-foreground">
        Who receives new work orders for each building. New requests auto-route to the covering
        technician; anything uncovered goes to the fallback.
      </p>

      <Panel className="mb-6">
        <SectionHeading>Coverage at a glance</SectionHeading>
        {byTech.size === 0 && unassigned.length === 0 ? (
          <p className="text-label text-muted-foreground">No buildings yet.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {[...byTech.entries()].map(([techId, names]) => (
              <li key={techId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-medium text-foreground">{techName.get(techId) ?? "—"}</span>
                <span className="text-right text-label text-muted-foreground">{names.join(" · ")}</span>
              </li>
            ))}
            {unassigned.length > 0 && (
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border/50 pt-2">
                <span className="font-medium text-urgency-blocked">No technician</span>
                <span className="text-right text-label text-muted-foreground">{unassigned.join(" · ")}</span>
              </li>
            )}
          </ul>
        )}
      </Panel>

      <Panel className="mb-6">
        <SectionHeading>Fallback</SectionHeading>
        <form action={setOrgFallbackAssigneeAction} className="mt-1 flex flex-wrap items-center gap-2 text-label">
          <label className="text-muted-foreground">Requests for uncovered buildings go to</label>
          <Select name="userId" defaultValue={fallback ?? ""} className="w-auto">
            <option value="">— no fallback (ops queue only) —</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? t.email}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm">Save</Button>
        </form>
      </Panel>

      <SectionHeading>Building coverage</SectionHeading>
      {properties.length === 0 ? (
        <EmptyState title="No buildings yet." description="Add buildings under Buildings & units." />
      ) : (
        <ul className="mt-1 divide-y divide-border/50">
          {properties.map((p) => {
            const n = unitCount.get(p.id) ?? 0;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-1 py-3">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="ml-2 text-meta text-muted-foreground">
                    {n} unit{n === 1 ? "" : "s"}
                  </span>
                </div>
                <form action={setPropertyAssigneeAction} className="flex items-center gap-2 text-label">
                  <input type="hidden" name="propertyId" value={p.id} />
                  <label className="text-muted-foreground">Covered by</label>
                  <Select name="userId" defaultValue={p.defaultAssigneeUserId ?? ""} className="w-auto">
                    <option value="">— unassigned —</option>
                    {techs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name ?? t.email}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline" size="sm">Save</Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
