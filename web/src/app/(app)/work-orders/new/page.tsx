import Link from "next/link";
import { listProperties, listUnits } from "@/lib/server/properties";
import { createWorkOrderAction } from "../_actions";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

async function action(formData: FormData) {
  "use server";
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  await createWorkOrderAction({
    title: String(formData.get("title")),
    description: String(formData.get("description") ?? "") || undefined,
    priority: (formData.get("priority") as never) ?? "normal",
    propertyId: propertyId || undefined,
    unitId: unitId || undefined,
    kind: "work_order",
  });
}

export default async function NewWorkOrderPage() {
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">New work order</h1>
      </header>
      <form action={action} className="space-y-3">
        <Field label="Title">
          <input
            required
            name="title"
            maxLength={200}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            rows={4}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Priority">
          <select
            name="priority"
            defaultValue="normal"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
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
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
        >
          Create
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
