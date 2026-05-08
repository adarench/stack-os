import Link from "next/link";
import { listProperties, listUnits } from "@/lib/server/properties";
import { INSPECTION_KINDS } from "@contracts/state-machines/inspection";
import { createInspectionAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/inspections" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">New inspection</h1>
      </header>
      <form action={createInspectionAction} className="space-y-3">
        <Field label="Kind">
          <select
            name="kind"
            defaultValue="ad_hoc"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {INSPECTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Property">
          <select
            name="propertyId"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— none —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit">
          <select
            name="unitId"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— none —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
        >
          Start inspection
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}
