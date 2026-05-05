import Link from "next/link";
import { listProperties, listUnits } from "@/lib/server/properties";
import { createPropertyAction, createUnitAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);
  const unitsByProperty = new Map<string, typeof units>();
  for (const u of units) {
    const arr = unitsByProperty.get(u.propertyId) ?? [];
    arr.push(u);
    unitsByProperty.set(u.propertyId, arr);
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Properties &amp; units</h1>
      </header>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Add property
        </h2>
        <form action={createPropertyAction} className="grid grid-cols-2 gap-2 text-sm">
          <input
            required
            name="name"
            placeholder="Name"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="addressLine1"
            placeholder="Address"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input name="city" placeholder="City" className="rounded border border-neutral-300 px-2 py-1.5" />
          <input name="state" placeholder="State" className="rounded border border-neutral-300 px-2 py-1.5" />
          <input
            name="postalCode"
            placeholder="ZIP"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="col-span-2 mt-1 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Add property
          </button>
        </form>
      </section>

      {properties.length === 0 ? (
        <p className="text-sm text-neutral-500">No properties yet.</p>
      ) : (
        <ul className="space-y-3">
          {properties.map((p) => (
            <li key={p.id} className="rounded border border-neutral-200 bg-white p-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{p.name}</h3>
                <span className="text-xs text-neutral-500">
                  {p.city ?? ""} {p.state ?? ""}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {(unitsByProperty.get(p.id) ?? []).map((u) => (
                  <li key={u.id} className="text-neutral-700">
                    · {u.label}
                  </li>
                ))}
              </ul>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-neutral-500">+ add unit</summary>
                <form action={createUnitAction} className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <input type="hidden" name="propertyId" value={p.id} />
                  <input
                    required
                    name="label"
                    placeholder="Unit label"
                    className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
                  />
                  <input
                    name="bedrooms"
                    placeholder="BR"
                    className="rounded border border-neutral-300 px-2 py-1.5"
                  />
                  <input
                    name="bathrooms"
                    placeholder="BA"
                    className="rounded border border-neutral-300 px-2 py-1.5"
                  />
                  <button
                    type="submit"
                    className="col-span-2 rounded bg-neutral-900 px-2 py-1.5 text-white"
                  >
                    Add unit
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
