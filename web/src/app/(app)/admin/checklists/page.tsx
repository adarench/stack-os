import Link from "next/link";
import { X } from "lucide-react";
import { listChecklistTemplates } from "@/lib/server/checklists";
import {
  createChecklistTemplateAction,
  addChecklistTemplateItemAction,
  removeChecklistTemplateItemAction,
} from "./_actions";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function AdminChecklistsPage() {
  const templates = await listChecklistTemplates();

  return (
    <Page width="default">
      <PageHeader
        title="Inspection checklists"
        backHref="/inspections"
        description="Reusable checklists pre-fill an inspection's check-off items. Start an inspection “from a checklist” on the new-inspection screen."
      />

      <Panel className="mb-6">
        <SectionHeading>New checklist</SectionHeading>
        <form action={createChecklistTemplateAction} className="flex gap-2">
          <Input
            required
            name="name"
            placeholder="Checklist name (e.g. Weekly property walk)"
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Create
          </Button>
        </form>
      </Panel>

      {templates.length === 0 ? (
        <EmptyState
          title="No checklists yet."
          description="Create one above, then add steps to it."
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Panel key={t.id}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-title font-medium text-foreground">{t.name}</h3>
                <span className="text-label text-muted-foreground">
                  {t.items.length} {t.items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {t.items.length > 0 && (
                <ul className="mt-2 divide-y divide-border/50">
                  {t.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-2 px-2 py-2.5 text-body hover:bg-muted/40"
                    >
                      <span className="flex-1 text-foreground">{it.title}</span>
                      <form action={removeChecklistTemplateItemAction}>
                        <input type="hidden" name="id" value={it.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove item"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </Button>
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
                <Input
                  required
                  name="title"
                  placeholder="Add a step…"
                  className="flex-1"
                />
                <Button type="submit" variant="outline" size="sm">
                  Add step
                </Button>
              </form>
            </Panel>
          ))}
        </div>
      )}
    </Page>
  );
}
