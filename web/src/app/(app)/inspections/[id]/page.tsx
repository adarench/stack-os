import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInspection,
  listFindings,
  listSpawnedWorkOrders,
} from "@/lib/server/inspections";
import { listInspectionItems } from "@/lib/server/checklists";
import { listProperties, listUnits } from "@/lib/server/properties";
import { FINDING_SEVERITIES, type FindingSeverity } from "@contracts/finding-severity";
import type { InspectionStatus } from "@contracts/state-machines/inspection";
import {
  addFindingAction,
  completeInspectionAction,
  removeFindingAction,
  reviewInspectionAction,
  updateFindingAction,
  addInspectionItemAction,
  toggleInspectionItemAction,
  removeInspectionItemAction,
} from "../_actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<InspectionStatus, string> = {
  scheduled: "bg-neutral-100 text-neutral-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  reviewed: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-neutral-200 text-neutral-500 line-through",
};

const SEVERITY_BADGE: Record<FindingSeverity, string> = {
  info: "bg-neutral-100 text-neutral-700",
  observation: "bg-sky-100 text-sky-800",
  actionable: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-800",
};

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inspection = await getInspection(id);
  if (!inspection) notFound();

  const [findings, spawned, properties, units, items] = await Promise.all([
    listFindings(id),
    listSpawnedWorkOrders(id),
    listProperties(),
    listUnits(),
    listInspectionItems(id),
  ]);
  const doneCount = items.filter((i) => i.completedAt !== null).length;

  const property = inspection.propertyId
    ? properties.find((p) => p.id === inspection.propertyId)
    : null;
  const unit = inspection.unitId ? units.find((u) => u.id === inspection.unitId) : null;
  const status = inspection.status as InspectionStatus;
  const isLocked = status === "completed" || status === "reviewed" || status === "cancelled";
  const failedActionable = findings.filter(
    (f) => !f.pass && (f.severity === "actionable" || f.severity === "critical"),
  );

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/inspections" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <span className="text-xs text-neutral-500">{inspection.kind.replace(/_/g, " ")}</span>
        <span className="ml-auto">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_PILL[status]}`}
          >
            {status.replace(/_/g, " ")}
          </span>
        </span>
      </header>

      <h1 className="text-lg font-semibold">
        {property?.name ?? "Inspection"}
        {unit && (
          <span className="text-base font-normal text-neutral-600"> · {unit.label}</span>
        )}
      </h1>
      {inspection.notes && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{inspection.notes}</p>
      )}

      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Checklist
          {items.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                doneCount === items.length
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {doneCount}/{items.length} done
            </span>
          )}
        </h2>

        {items.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No checklist items. Add steps below, or start an inspection from a template.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((it) => {
              const done = it.completedAt !== null;
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-2 rounded border border-neutral-200 bg-white p-2 text-sm"
                >
                  <form action={toggleInspectionItemAction} className="flex">
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="inspectionId" value={inspection.id} />
                    <button
                      type="submit"
                      disabled={isLocked}
                      aria-label={done ? "Mark not done" : "Mark done"}
                      className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                        done
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-neutral-300 bg-white text-transparent"
                      } ${isLocked ? "opacity-60" : ""}`}
                    >
                      ✓
                    </button>
                  </form>
                  <span
                    className={`flex-1 ${done ? "text-neutral-400 line-through" : "text-neutral-800"}`}
                  >
                    {it.title}
                  </span>
                  {!isLocked && (
                    <form action={removeInspectionItemAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                      <button
                        type="submit"
                        aria-label="Remove item"
                        className="text-xs text-neutral-400 hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!isLocked && (
          <form action={addInspectionItemAction} className="mt-2 flex gap-2">
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <input
              required
              name="title"
              placeholder="Add a checklist step…"
              className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Add
            </button>
          </form>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Findings ({findings.length})
        </h2>

        {findings.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No findings yet. Add the first one below as you walk the property.
          </p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.id} className="rounded border border-neutral-200 bg-white p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SEVERITY_BADGE[f.severity as FindingSeverity]}`}
                  >
                    {f.severity}
                  </span>
                  {f.area && (
                    <span className="text-xs text-neutral-500">{f.area}</span>
                  )}
                  <span
                    className={`ml-auto text-xs font-medium uppercase ${
                      f.pass ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {f.pass ? "PASS" : "FAIL"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{f.description}</p>
                {f.spawnedWorkOrderId && (
                  <Link
                    href={`/work-orders/${f.spawnedWorkOrderId}`}
                    className="mt-1 block text-xs text-blue-700 underline"
                  >
                    → Spawned WO
                  </Link>
                )}
                {!isLocked && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <form action={updateFindingAction} className="flex gap-1">
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                      <input type="hidden" name="pass" value={String(!f.pass)} />
                      <button
                        type="submit"
                        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-700"
                      >
                        Mark {f.pass ? "fail" : "pass"}
                      </button>
                    </form>
                    <form action={removeFindingAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                      <button
                        type="submit"
                        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-500"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!isLocked && (
          <form action={addFindingAction} className="mt-3 space-y-2 rounded border border-dashed border-neutral-300 bg-white p-3 text-sm">
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="area"
                placeholder='Area (e.g. "kitchen")'
                className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
              />
              <select
                name="severity"
                defaultValue="observation"
                className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
              >
                {FINDING_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              required
              name="description"
              rows={2}
              placeholder="What did you find? (Description spawns a WO if severity ≥ actionable AND pass is unchecked.)"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <label className="flex items-center gap-2 text-xs text-neutral-700">
              <input type="checkbox" name="pass" value="true" defaultChecked />
              Pass (uncheck to fail; failed actionable/critical findings spawn a WO at completion)
            </label>
            <button
              type="submit"
              className="w-full rounded bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
            >
              Add finding
            </button>
          </form>
        )}
      </section>

      {spawned.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Spawned WOs ({spawned.length})
          </h2>
          <ul className="space-y-1">
            {spawned.map((w) => (
              <li key={w.id} className="text-sm">
                <Link
                  href={`/work-orders/${w.id}`}
                  className="text-blue-700 underline"
                >
                  WO-{w.number}
                </Link>{" "}
                <span className="text-neutral-700">{w.title}</span>{" "}
                <span className="text-xs text-neutral-500">[{w.status}]</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        {status === "scheduled" || status === "in_progress" ? (
          <form action={completeInspectionAction}>
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <button
              type="submit"
              className="w-full rounded bg-emerald-700 px-3 py-3 text-sm font-medium text-white"
            >
              Complete inspection
              {failedActionable.length > 0 && (
                <span className="ml-2 text-xs opacity-90">
                  ({failedActionable.length} WO{failedActionable.length === 1 ? "" : "s"} will spawn)
                </span>
              )}
            </button>
          </form>
        ) : status === "completed" ? (
          <form action={reviewInspectionAction}>
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <button
              type="submit"
              className="w-full rounded bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
            >
              Mark reviewed
            </button>
          </form>
        ) : (
          <p className="text-center text-xs text-neutral-500">
            Terminal state. Inspection is locked.
          </p>
        )}
      </section>
    </main>
  );
}
