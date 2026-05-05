import Link from "next/link";
import { listVendors, listVendorUsersForVendor } from "@/lib/server/vendors";
import { createVendorAction, inviteVendorUserAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const vendors = await listVendors();
  const usersByVendor = new Map<string, Awaited<ReturnType<typeof listVendorUsersForVendor>>>();
  for (const v of vendors) {
    usersByVendor.set(v.id, await listVendorUsersForVendor(v.id));
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Vendors</h1>
      </header>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Add vendor
        </h2>
        <form action={createVendorAction} className="grid grid-cols-2 gap-2 text-sm">
          <input
            required
            name="name"
            placeholder="Name"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="trade"
            placeholder="Trade (plumbing, etc.)"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="primaryContactName"
            placeholder="Contact"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="primaryEmail"
            type="email"
            placeholder="Email"
            className="rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            name="primaryPhone"
            placeholder="Phone"
            className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="col-span-2 mt-1 rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Add vendor
          </button>
        </form>
      </section>

      {vendors.length === 0 ? (
        <p className="text-sm text-neutral-500">No vendors yet.</p>
      ) : (
        <ul className="space-y-3">
          {vendors.map((v) => (
            <li key={v.id} className="rounded border border-neutral-200 bg-white p-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{v.name}</h3>
                <span className="text-xs text-neutral-500">{v.trade ?? ""}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {(usersByVendor.get(v.id) ?? []).map((u) => (
                  <li key={u.id} className="text-neutral-700">
                    · {u.name ?? u.email}{" "}
                    <span className="text-xs text-neutral-500">({u.status})</span>
                  </li>
                ))}
              </ul>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-neutral-500">
                  + invite vendor user
                </summary>
                <form action={inviteVendorUserAction} className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <input type="hidden" name="vendorId" value={v.id} />
                  <input
                    required
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="col-span-2 rounded border border-neutral-300 px-2 py-1.5"
                  />
                  <input
                    name="name"
                    placeholder="Name"
                    className="rounded border border-neutral-300 px-2 py-1.5"
                  />
                  <input
                    name="phone"
                    placeholder="Phone"
                    className="rounded border border-neutral-300 px-2 py-1.5"
                  />
                  <button
                    type="submit"
                    className="col-span-2 rounded bg-neutral-900 px-2 py-1.5 text-white"
                  >
                    Send magic link
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
