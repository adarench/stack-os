import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, X } from "lucide-react";
import {
  getInspection,
  listFindings,
  listSpawnedWorkOrders,
} from "@/lib/server/inspections";
import { listInspectionItems } from "@/lib/server/checklists";
import { listProperties, listUnits } from "@/lib/server/properties";
import { FINDING_SEVERITIES, type FindingSeverity } from "@contracts/finding-severity";
import type { InspectionStatus } from "@contracts/state-machines/inspection";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea, Select } from "@/components/ui/form";
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

const SEVERITY_TONE: Record<FindingSeverity, BadgeTone> = {
  info: "muted",
  observation: "inflow",
  actionable: "blocked",
  critical: "overdue",
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
    <Page width="narrow">
      <PageHeader
        backHref="/inspections"
        eyebrow={inspection.kind.replace(/_/g, " ")}
        title={
          <>
            {property?.name ?? "Inspection"}
            {unit && (
              <span className="font-normal text-muted-foreground"> · {unit.label}</span>
            )}
          </>
        }
        actions={
          <Badge tone={toneForStatus(status)}>{status.replace(/_/g, " ")}</Badge>
        }
      />
      {inspection.notes && (
        <p className="whitespace-pre-wrap text-body text-foreground">{inspection.notes}</p>
      )}

      <section className="mt-5">
        <SectionHeading className="flex items-center gap-2">
          Checklist
          {items.length > 0 && (
            <Badge tone={doneCount === items.length ? "done" : "muted"}>
              {doneCount}/{items.length} done
            </Badge>
          )}
        </SectionHeading>

        {items.length === 0 ? (
          <EmptyState
            title="No checklist items."
            description="Add steps below, or start an inspection from a template."
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((it) => {
              const done = it.completedAt !== null;
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-2 px-2 py-2.5 text-body hover:bg-muted/40"
                >
                  <form action={toggleInspectionItemAction} className="flex">
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="inspectionId" value={inspection.id} />
                    <button
                      type="submit"
                      disabled={isLocked}
                      aria-label={done ? "Mark not done" : "Mark done"}
                      className={`flex size-5 items-center justify-center rounded border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                        done
                          ? "border-urgency-done bg-urgency-done text-white"
                          : "border-input bg-card text-transparent"
                      } ${isLocked ? "opacity-60" : ""}`}
                    >
                      <Check className="size-3.5" />
                    </button>
                  </form>
                  <span
                    className={`flex-1 ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {it.title}
                  </span>
                  {!isLocked && (
                    <form action={removeInspectionItemAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove item"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </Button>
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
            <Input
              required
              name="title"
              placeholder="Add a checklist step…"
              className="flex-1"
            />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        )}
      </section>

      <section className="mt-5">
        <SectionHeading>Findings ({findings.length})</SectionHeading>

        {findings.length === 0 ? (
          <EmptyState
            title="No findings yet."
            description="Add the first one below as you walk the property."
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {findings.map((f) => (
              <li key={f.id} className="px-2 py-2.5 text-body hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <Badge tone={SEVERITY_TONE[f.severity as FindingSeverity]}>
                    {f.severity}
                  </Badge>
                  {f.area && (
                    <span className="text-label text-muted-foreground">{f.area}</span>
                  )}
                  <Badge tone={f.pass ? "done" : "overdue"} className="ml-auto">
                    {f.pass ? "Pass" : "Fail"}
                  </Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{f.description}</p>
                {f.spawnedWorkOrderId && (
                  <Link
                    href={`/work-orders/${f.spawnedWorkOrderId}`}
                    className="mt-1 inline-flex items-center gap-1 text-label text-foreground underline"
                  >
                    <ChevronRight className="size-3.5" />
                    Spawned WO
                  </Link>
                )}
                {!isLocked && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={updateFindingAction} className="flex gap-1">
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                      <input type="hidden" name="pass" value={String(!f.pass)} />
                      <Button type="submit" variant="outline" size="sm">
                        Mark {f.pass ? "fail" : "pass"}
                      </Button>
                    </form>
                    <form action={removeFindingAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!isLocked && (
          <Panel className="mt-3">
            <form action={addFindingAction} className="space-y-2 text-body">
              <input type="hidden" name="inspectionId" value={inspection.id} />
              <div className="grid grid-cols-2 gap-2">
                <Input name="area" placeholder='Area (e.g. "kitchen")' />
                <Select name="severity" defaultValue="observation">
                  {FINDING_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                required
                name="description"
                rows={2}
                placeholder="What did you find? (Description spawns a WO if severity ≥ actionable AND pass is unchecked.)"
              />
              <label className="flex items-center gap-2 text-label text-foreground">
                <input type="checkbox" name="pass" value="true" defaultChecked />
                Pass (uncheck to fail; failed actionable/critical findings spawn a WO at completion)
              </label>
              <Button type="submit" className="w-full">
                Add finding
              </Button>
            </form>
          </Panel>
        )}
      </section>

      {spawned.length > 0 && (
        <section className="mt-5">
          <SectionHeading>Spawned WOs ({spawned.length})</SectionHeading>
          <ul className="divide-y divide-border/50">
            {spawned.map((w) => (
              <li key={w.id} className="px-2 py-2.5 text-body hover:bg-muted/40">
                <Link
                  href={`/work-orders/${w.id}`}
                  className="text-foreground underline"
                >
                  WO-{w.number}
                </Link>{" "}
                <span className="text-foreground">{w.title}</span>{" "}
                <span className="text-label text-muted-foreground">[{w.status}]</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        {status === "scheduled" || status === "in_progress" ? (
          <form action={completeInspectionAction}>
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <Button type="submit" size="lg" className="w-full">
              Complete inspection
              {failedActionable.length > 0 && (
                <span className="ml-2 text-label opacity-90">
                  ({failedActionable.length} WO{failedActionable.length === 1 ? "" : "s"} will spawn)
                </span>
              )}
            </Button>
          </form>
        ) : status === "completed" ? (
          <form action={reviewInspectionAction}>
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <Button type="submit" size="lg" className="w-full">
              Mark reviewed
            </Button>
          </form>
        ) : (
          <p className="text-center text-label text-muted-foreground">
            Terminal state. Inspection is locked.
          </p>
        )}
      </section>
    </Page>
  );
}
