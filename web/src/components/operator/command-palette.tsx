"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ClipboardList,
  ClipboardPlus,
  FolderPlus,
  Inbox,
  ListTodo,
  Plus,
  Search,
  ShieldCheck,
  type LucideIcon,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface PaletteCommand {
  id: string;
  label: string;
  group: "Navigate" | "Create" | "Search";
  icon?: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used inside <CommandPaletteProvider>",
    );
  }
  return ctx;
}

/**
 * Global command palette. Mount once at the AppShell level. Opens on ⌘K
 * anywhere, and on `/` when the user is not typing in an input.
 *
 * Commands are statically declared here for v1. Surface-scoped commands can
 * be added via a register/unregister API in a later step.
 */
interface EntityHit {
  ref: string;
  type: "wo" | "ins" | "prj";
  title: string;
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<EntityHit[]>([]);
  const router = useRouter();

  // Reset typeahead state when the palette closes so reopens start clean.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  // Debounced entity search — fires after the operator pauses typing.
  // Empty queries clear hits without a network call.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/me/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const data = (await r.json()) as { hits: EntityHit[] };
        if (!cancelled) setHits(data.hits ?? []);
      } catch {
        if (!cancelled) setHits([]);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  // Global keybinding: ⌘K / Ctrl+K toggles; `/` opens when not in an input.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !inField && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Static command catalogue. Scoped variants currently route to the parent
  // surface — query-string filters land in their respective steps.
  const commands: PaletteCommand[] = React.useMemo(
    () => [
      // Navigate
      {
        id: "nav-now",
        label: "Go to Now",
        group: "Navigate",
        icon: Activity,
        shortcut: "g n",
        run: () => go("/now"),
      },
      {
        id: "nav-work",
        label: "Go to Work",
        group: "Navigate",
        icon: ListTodo,
        shortcut: "g w",
        run: () => go("/work"),
      },
      {
        id: "nav-work-overdue",
        label: "Go to Work · Overdue",
        group: "Navigate",
        icon: ListTodo,
        keywords: ["overdue", "late"],
        run: () => go("/work?due=overdue"),
      },
      {
        id: "nav-work-dispatcher",
        label: "Go to Work · Dispatcher",
        group: "Navigate",
        icon: ListTodo,
        keywords: ["unassigned", "queue"],
        run: () => go("/work?view=dispatcher"),
      },
      {
        id: "nav-compliance",
        label: "Go to Compliance",
        group: "Navigate",
        icon: ShieldCheck,
        shortcut: "g c",
        run: () => go("/compliance"),
      },
      {
        id: "nav-compliance-cois",
        label: "Go to Compliance · COIs expiring",
        group: "Navigate",
        icon: ShieldCheck,
        keywords: ["coi", "expiring", "vendor"],
        run: () => go("/compliance?tab=cois&filter=expiring"),
      },
      {
        id: "nav-money",
        label: "Go to Money",
        group: "Navigate",
        icon: Wallet,
        shortcut: "g m",
        run: () => go("/money"),
      },
      {
        id: "nav-money-approvals",
        label: "Go to Money · Pending approvals",
        group: "Navigate",
        icon: Wallet,
        keywords: ["approval", "pending"],
        run: () => go("/money?tab=approvals"),
      },
      {
        id: "nav-inbox",
        label: "Go to Inbox",
        group: "Navigate",
        icon: Inbox,
        shortcut: "g i",
        run: () => go("/inbox"),
      },

      // Create
      {
        id: "create-wo",
        label: "New work order",
        group: "Create",
        icon: Plus,
        keywords: ["wo", "create", "new"],
        run: () => go("/work/new"),
      },
      {
        id: "create-inspection",
        label: "New inspection",
        group: "Create",
        icon: ClipboardPlus,
        keywords: ["ins", "inspect"],
        run: () => go("/inspections/new"),
      },
      {
        id: "create-project",
        label: "New project",
        group: "Create",
        icon: FolderPlus,
        keywords: ["prj"],
        run: () => go("/projects/new"),
      },
      {
        id: "create-coi",
        label: "New COI record",
        group: "Create",
        icon: ShieldCheck,
        keywords: ["coi", "vendor", "insurance"],
        run: () => go("/admin/compliance/cois"),
      },
      {
        id: "create-tenant-invite",
        label: "Invite tenant",
        group: "Create",
        icon: ClipboardList,
        keywords: ["tenant", "invite", "insurance"],
        run: () => go("/admin/compliance/tenants"),
      },
    ],
    [go],
  );

  const grouped = React.useMemo(() => {
    const out: Record<PaletteCommand["group"], PaletteCommand[]> = {
      Navigate: [],
      Create: [],
      Search: [],
    };
    for (const cmd of commands) out[cmd.group].push(cmd);
    return out;
  }, [commands]);

  const value = React.useMemo<CommandPaletteContextValue>(
    () => ({ open, setOpen, toggle: () => setOpen((v) => !v) }),
    [open],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search or jump to…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>

          {hits.length > 0 && (
            <CommandGroup heading="Entities">
              {hits.map((hit) => (
                <CommandItem
                  key={hit.ref}
                  value={`${hit.ref} ${hit.title}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`?d=${encodeURIComponent(hit.ref)}`, {
                      scroll: false,
                    });
                  }}
                >
                  <Search className="text-muted-foreground" />
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {hit.ref}
                  </span>
                  <span className="flex-1 truncate">{hit.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {grouped.Navigate.length > 0 && (
            <>
              {hits.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Navigate">
                {grouped.Navigate.map((cmd) => (
                  <CommandRow key={cmd.id} cmd={cmd} />
                ))}
              </CommandGroup>
            </>
          )}

          {grouped.Create.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Create">
                {grouped.Create.map((cmd) => (
                  <CommandRow key={cmd.id} cmd={cmd} />
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>

        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 font-mono">
                ⏎
              </kbd>
              run
            </span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 font-mono">
              esc
            </kbd>
            close
          </span>
        </div>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}

function CommandRow({ cmd }: { cmd: PaletteCommand }) {
  const Icon = cmd.icon ?? Search;
  return (
    <CommandItem
      value={`${cmd.label} ${(cmd.keywords ?? []).join(" ")}`}
      onSelect={cmd.run}
    >
      <Icon className="text-muted-foreground" />
      <span className="flex-1 truncate">{cmd.label}</span>
      {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
    </CommandItem>
  );
}
