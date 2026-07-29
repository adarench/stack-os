import { listResidentsAdmin, listUnits } from "@/lib/server/properties";
import { Page, PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountActions } from "../_account-actions";
import { ReassignUnit } from "./_reassign-unit";

export const dynamic = "force-dynamic";

/** Resident (tenant) account management — status, unit, deactivate/reset. */
export default async function AdminResidentsPage() {
  const [residents, units] = await Promise.all([listResidentsAdmin(), listUnits()]);
  const unitOpts = units.map((u) => ({ id: u.id, label: u.label }));

  return (
    <Page width="default">
      <PageHeader title="Residents" backHref="/work" />

      {residents.length === 0 ? (
        <EmptyState title="No residents yet." description="Add them from Team → Add a person, or invite them." />
      ) : (
        <ul className="divide-y divide-border/50">
          {residents.map((t) => {
            const active = t.status !== "revoked";
            return (
              <li key={t.id} className={`px-2 py-2.5 text-body ${active ? "" : "opacity-60"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{t.name ?? t.email}</span>
                  <span className="text-label text-muted-foreground">{t.email}</span>
                </div>
                <div className="mt-0.5 text-meta text-muted-foreground">
                  {t.propertyName ? `${t.propertyName} · ` : ""}
                  {t.unitLabel ?? "no unit"}
                  {!active && <span className="text-urgency-blocked"> · deactivated</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-label text-muted-foreground">
                    Unit
                    <ReassignUnit tenantId={t.id} unitId={t.unitId} units={unitOpts} />
                  </label>
                  <AccountActions type="tenant" id={t.id} active={active} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
