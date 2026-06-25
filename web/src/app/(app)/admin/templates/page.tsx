import { listTemplates } from "@/lib/server/templates";
import { listProperties, listUnits } from "@/lib/server/properties";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createTemplateAction,
  spawnNowAction,
  toggleTemplateActiveAction,
} from "./_actions";

export const dynamic = "force-dynamic";

/** Friendly names for the cadence-preset crons; unknown crons render raw. */
const CRON_LABELS: Record<string, string> = {
  "0 9 * * 1": "Weekly · Mondays 9am",
  "0 9 * * 5": "Weekly · Fridays 9am",
  "0 9 1 * *": "Monthly · 1st, 9am",
  "0 9 1 1,4,7,10 *": "Quarterly · 1st, 9am",
  "0 9 1 1 *": "Annually · Jan 1st, 9am",
};

export default async function AdminTemplatesPage() {
  const [templates, properties, units] = await Promise.all([
    listTemplates(),
    listProperties(),
    listUnits(),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const unitById = new Map(units.map((u) => [u.id, u]));

  return (
    <Page width="default">
      <PageHeader title="Recurring tasks" backHref="/work" />

      <Panel className="mb-6">
        <SectionHeading>New template</SectionHeading>
        <form action={createTemplateAction} className="grid grid-cols-2 gap-2">
          <Input
            required
            name="name"
            placeholder="Template name (e.g. Weekly common-area inspection)"
            className="col-span-2"
          />
          <Input
            required
            name="defaultTitle"
            placeholder='Default WO title (e.g. "Common-area walkthrough")'
            className="col-span-2"
          />
          <Textarea
            name="defaultDescription"
            placeholder="Default description (optional)"
            rows={2}
            className="col-span-2"
          />
          <Select name="cadence" defaultValue="weekly_mon" className="col-span-2">
            <option value="weekly_mon">Weekly · Mondays 9am</option>
            <option value="weekly_fri">Weekly · Fridays 9am</option>
            <option value="monthly_first">Monthly · 1st, 9am</option>
            <option value="quarterly">Quarterly · Jan/Apr/Jul/Oct 1st, 9am</option>
            <option value="annual">Annually · Jan 1st, 9am</option>
            <option value="custom">Custom schedule (cron below)</option>
          </Select>
          <Input
            name="cron"
            placeholder='Custom cron — only used with "Custom schedule", e.g. "0 9 * * 1"'
            className="col-span-2 font-mono"
          />
          <Input
            name="timezone"
            placeholder="Timezone (default America/Denver)"
            defaultValue="America/Denver"
          />
          <Input
            name="leadTimeHours"
            type="number"
            min={0}
            placeholder="Lead time hours (due_at = fire_at + N)"
            defaultValue={0}
          />
          <Select name="defaultPriority" defaultValue="normal">
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                priority: {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Select name="defaultPropertyId" defaultValue="">
            <option value="">— no default property —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select name="defaultUnitId" defaultValue="" className="col-span-2">
            <option value="">— no default unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
          <Button type="submit" className="col-span-2 mt-1">
            Create template
          </Button>
        </form>
      </Panel>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet."
          description="Create one above to schedule recurring work orders. The hourly Inngest cron evaluates each template's schedule and spawns a WO when its next_fire_at is due."
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {templates.map((t) => {
            const prop = t.defaultPropertyId ? propertyById.get(t.defaultPropertyId) : null;
            const unit = t.defaultUnitId ? unitById.get(t.defaultUnitId) : null;
            return (
              <li
                key={t.id}
                className={`px-2 py-2.5 text-body ${t.isActive ? "" : "opacity-70"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium text-foreground">{t.name}</h3>
                  <span className="flex items-center gap-2 text-meta text-muted-foreground">
                    <Badge tone={toneForStatus(t.isActive ? "active" : "paused")}>
                      {t.isActive ? "active" : "paused"}
                    </Badge>
                    fired {t.timesFired}×
                  </span>
                </div>
                {t.description && (
                  <p className="mt-1 text-body text-muted-foreground">{t.description}</p>
                )}
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-label text-muted-foreground">
                  <dt>schedule</dt>
                  <dd className={CRON_LABELS[t.cron] ? "" : "font-mono"}>
                    {CRON_LABELS[t.cron] ?? t.cron}{" "}
                    <span className="text-muted-foreground">({t.timezone})</span>
                  </dd>
                  <dt>default title</dt>
                  <dd>{t.defaultTitle}</dd>
                  <dt>scope</dt>
                  <dd>{prop?.name ?? "(any property)"}{unit ? ` · ${unit.label}` : ""}</dd>
                  <dt>priority</dt>
                  <dd>{t.defaultPriority.replace(/_/g, " ")}</dd>
                  <dt>lead time</dt>
                  <dd>{t.leadTimeHours}h</dd>
                  <dt>next fire</dt>
                  <dd>{t.nextFireAt ? new Date(t.nextFireAt).toLocaleString() : "—"}</dd>
                  <dt>last fire</dt>
                  <dd>{t.lastFiredAt ? new Date(t.lastFiredAt).toLocaleString() : "—"}</dd>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={spawnNowAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" size="sm">
                      Spawn now
                    </Button>
                  </form>
                  <form action={toggleTemplateActiveAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="next" value={t.isActive ? "false" : "true"} />
                    <Button type="submit" variant="outline" size="sm">
                      {t.isActive ? "Pause" : "Resume"}
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
