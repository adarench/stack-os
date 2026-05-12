import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  FileText,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Section = "properties" | "vendors" | "templates";

interface SectionDef {
  value: Section;
  label: string;
  icon: typeof Building2;
  description: string;
  legacyHref: string;
}

// Only sections that have a real destination ship in the sub-nav. Members,
// notifications, and integrations will join once they have native editors.
const SECTIONS: SectionDef[] = [
  {
    value: "properties",
    label: "Properties & units",
    icon: Building2,
    description:
      "Manage properties and their units. AppFolio external IDs live here for future sync.",
    legacyHref: "/admin/properties",
  },
  {
    value: "vendors",
    label: "Vendors",
    icon: Wrench,
    description:
      "Add vendors, invite vendor users via magic-link, configure assign-gate behaviour.",
    legacyHref: "/admin/vendors",
  },
  {
    value: "templates",
    label: "Recurring templates",
    icon: FileText,
    description:
      "Define recurring work-order templates that Inngest spawns on schedule.",
    legacyHref: "/admin/templates",
  },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const sp = await searchParams;
  const sectionParam = strOrNull(sp.section);
  const section: Section =
    (SECTIONS.find((s) => s.value === sectionParam)?.value ?? "properties");
  const def = SECTIONS.find((s) => s.value === section)!;
  const Icon = def.icon;

  return (
    <div className="mx-auto flex min-h-[calc(100svh-44px)] max-w-[1080px] flex-col md:flex-row">
      {/* Sub-nav */}
      <aside className="w-full shrink-0 border-b border-border md:w-56 md:border-b-0 md:border-r">
        <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:gap-0.5 md:overflow-visible">
          {SECTIONS.map((s) => {
            const active = s.value === section;
            const SubIcon = s.icon;
            return (
              <Link
                key={s.value}
                href={`/settings?section=${s.value}`}
                scroll={false}
                className={cn(
                  "group flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <SubIcon className="size-3.5 shrink-0" />
                <span className="truncate">{s.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 px-3 py-4 md:px-6">
        <header className="mb-4 flex items-center gap-3">
          <Icon className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{def.label}</h1>
        </header>

        <p className="mb-6 text-sm text-muted-foreground">{def.description}</p>

        <div className="rounded-md border border-border bg-card p-4">
          <Button asChild variant="soft">
            <Link href={def.legacyHref}>
              <ExternalLink className="size-4" />
              Open {def.label.toLowerCase()}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
