import Link from "next/link";
import { listTemplates } from "@/lib/server/templates";
import { listProperties, listUnits } from "@/lib/server/properties";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";
import {
  createTemplateAction,
  spawnNowAction,
  toggleTemplateActiveAction,
} from "./_actions";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const [templates, properties, units] = await Promise.all([
    listTemplates(),
    listProperties(),
    listUnits(),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const unitById = new Map(units.map((u) => [u.id, u]));

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Recurring templates</h1>
      </header>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          New template
        </h2>
        <form action={createTemplateAction} className="grid grid-cols-2 gap-2 text-sm">
          <input
            required
            name="name"
            placeholder="Template name (e.g. Weekly common-area inspection)"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            required
            name="defaultTitle"
            placeholder='Default WO title (e.g. "Common-area walkthrough")'
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <textarea
            name="defaultDescription"
            placeholder="Default description (optional)"
            rows={2}
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            required
            name="cron"
            placeholder='Cron e.g. "0 9 * * 1" = Mondays 9am'
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5 font-mono"
          />
          <input
            name="timezone"
            placeholder="Timezone (default America/New_York)"
            defaultValue="America/New_York"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="leadTimeHours"
            type="number"
            min={0}
            placeholder="Lead time hours (due_at = fire_at + N)"
            defaultValue={0}
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <select
            name="defaultPriority"
            defaultValue="normal"
            className="rounded border border-neutral-300 px-2 py-1.5"
          >
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                priority: {p}
              </option>
            ))}
          </select>
          <select
            name="defaultPropertyId"
            defaultValue=""
            className="rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">— no default property —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="defaultUnitId"
            defaultValue=""
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">— no default unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="col-span-2 mt-1 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Create template
          </button>
        </form>
      </section>

      {templates.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No templates yet. Create one above to schedule recurring work
          orders. The hourly Inngest cron evaluates each template&apos;s
          schedule and spawns a WO when its <code>next_fire_at</code> is
          due.
        </p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => {
            const prop = t.defaultPropertyId ? propertyById.get(t.defaultPropertyId) : null;
            const unit = t.defaultUnitId ? unitById.get(t.defaultUnitId) : null;
            return (
              <li
                key={t.id}
                className={`rounded border p-3 ${
                  t.isActive ? "border-neutral-200 bg-white" : "border-neutral-200 bg-neutral-50 opacity-70"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">{t.name}</h3>
                  <span className="text-xs text-neutral-500">
                    {t.isActive ? "active" : "paused"} · fired {t.timesFired}×
                  </span>
                </div>
                {t.description && (
                  <p className="mt-1 text-sm text-neutral-700">{t.description}</p>
                )}
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-600">
                  <dt>cron</dt>
                  <dd className="font-mono">{t.cron} <span className="text-neutral-400">({t.timezone})</span></dd>
                  <dt>default title</dt>
                  <dd>{t.defaultTitle}</dd>
                  <dt>scope</dt>
                  <dd>{prop?.name ?? "(any property)"}{unit ? ` · ${unit.label}` : ""}</dd>
                  <dt>priority</dt>
                  <dd>{t.defaultPriority}</dd>
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
                    <button
                      type="submit"
                      className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Spawn now
                    </button>
                  </form>
                  <form action={toggleTemplateActiveAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="next" value={t.isActive ? "false" : "true"} />
                    <button
                      type="submit"
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-700"
                    >
                      {t.isActive ? "Pause" : "Resume"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
