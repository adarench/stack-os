import Link from "next/link";
import { listChecklistTemplates } from "@/lib/server/checklists";
import {
  createChecklistTemplateAction,
  addChecklistTemplateItemAction,
  removeChecklistTemplateItemAction,
} from "./_actions";

export const dynamic = "force-dynamic";

export default async function AdminChecklistsPage() {
  const templates = await listChecklistTemplates();

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/inspections" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Inspection checklists</h1>
      </header>

      <p className="mb-4 text-sm text-neutral-600">
        Reusable checklists pre-fill an inspection&apos;s check-off items. Start an
        inspection &ldquo;from a checklist&rdquo; on the new-inspection screen.
      </p>

      <section className="mb-6 rounded border border-neutral-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          New checklist
        </h2>
        <form action={createChecklistTemplateAction} className="flex gap-2 text-sm">
          <input
            required
            name="name"
            placeholder="Checklist name (e.g. Weekly property walk)"
            className="flex-1 rounded border border-neutral-300 px-2 py-1.5"
          />
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 font-medium text-white"
          >
            Create
          </button>
        </form>
      </section>

      {templates.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No checklists yet. Create one above, then add steps to it.
        </p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="rounded border border-neutral-200 bg-white p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium">{t.name}</h3>
                <span className="text-xs text-neutral-500">
                  {t.items.length} {t.items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {t.items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {t.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-2 rounded border border-neutral-100 bg-neutral-50 px-2 py-1 text-sm"
                    >
                      <span className="flex-1 text-neutral-800">{it.title}</span>
                      <form action={removeChecklistTemplateItemAction}>
                        <input type="hidden" name="id" value={it.id} />
                        <button
                          type="submit"
                          aria-label="Remove item"
                          className="text-xs text-neutral-400 hover:text-rose-600"
                        >
                          ✕
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={addChecklistTemplateItemAction}
                className="mt-2 flex gap-2"
              >
                <input type="hidden" name="templateId" value={t.id} />
                <input
                  required
                  name="title"
                  placeholder="Add a step…"
                  className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
                >
                  Add step
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
