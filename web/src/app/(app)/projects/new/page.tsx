import Link from "next/link";
import { listProperties, listUnits } from "@/lib/server/properties";
import { PROJECT_KINDS } from "@contracts/state-machines/project";
import { createProjectAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);
  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/projects" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">New project</h1>
      </header>
      <form action={createProjectAction} className="space-y-3">
        <Field label="Name">
          <input
            required
            name="name"
            maxLength={200}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            rows={3}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Kind">
          <select
            name="kind"
            defaultValue="general"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {PROJECT_KINDS.map((k) => (
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
        <Field label="Budget (cents)">
          <input
            name="budgetCents"
            type="number"
            min={0}
            placeholder="optional"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
        >
          Create project
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
