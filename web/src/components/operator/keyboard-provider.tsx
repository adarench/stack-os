"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCommandPalette } from "./command-palette";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Global keyboard model. The operator should never reach for the mouse.
 *
 *   j / k       move row focus
 *   o / ↵       open the focused row (drawer)
 *   x           toggle row selection (reserved — batch ops land in Tier 2)
 *   esc         close the drawer
 *   /           focus the search (opens the command palette)
 *   ?           toggle this shortcut overlay
 *   g then n    /now
 *   g then w    /work
 *   g then c    /compliance
 *   g then m    /money
 *   g then i    /inbox
 *
 * Rows opt in with `data-row="true"` and own focus via `tabIndex={0}`.
 * The provider stays stateless — focus is delegated to the browser; we
 * just move it.
 */
interface KeyboardCtx {
  openShortcuts: () => void;
}
const Ctx = React.createContext<KeyboardCtx | null>(null);

export function useShortcutHint(): () => void {
  const c = React.useContext(Ctx);
  return c?.openShortcuts ?? (() => {});
}

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const cmd = useCommandPalette();

  const [helpOpen, setHelpOpen] = React.useState(false);
  const goChord = React.useRef<number | null>(null);

  const openShortcuts = React.useCallback(() => setHelpOpen(true), []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip when typing in an input/textarea/contenteditable.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        // Allow only esc out of inputs.
        if (e.key !== "Escape") return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // g-chord navigation: press g, then a letter within 1s
      if (e.key === "g" && goChord.current === null) {
        e.preventDefault();
        goChord.current = window.setTimeout(() => {
          goChord.current = null;
        }, 1000);
        return;
      }
      if (goChord.current !== null) {
        const target =
          e.key === "n" ? "/now"
          : e.key === "w" ? "/work"
          : e.key === "c" ? "/compliance"
          : e.key === "m" ? "/money"
          : e.key === "i" ? "/inbox"
          : null;
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        clearTimeout(goChord.current);
        goChord.current = null;
        return;
      }

      switch (e.key) {
        case "?": {
          e.preventDefault();
          setHelpOpen((v) => !v);
          return;
        }
        case "/": {
          e.preventDefault();
          cmd.setOpen(true);
          return;
        }
        case "Escape": {
          // Close the drawer if one is open.
          if (sp.get("d")) {
            const next = new URLSearchParams(sp.toString());
            next.delete("d");
            const q = next.toString();
            router.replace(q ? `${pathname}?${q}` : pathname, {
              scroll: false,
            });
          }
          return;
        }
        case "j":
        case "ArrowDown": {
          if (moveRowFocus(1)) e.preventDefault();
          return;
        }
        case "k":
        case "ArrowUp": {
          if (moveRowFocus(-1)) e.preventDefault();
          return;
        }
        case "o":
        case "Enter": {
          const focused = document.activeElement as HTMLElement | null;
          if (focused?.dataset["row"] === "true") {
            e.preventDefault();
            focused.click();
          }
          return;
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, pathname, sp, cmd]);

  return (
    <Ctx.Provider value={{ openShortcuts }}>
      {children}
      <ShortcutOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </Ctx.Provider>
  );
}

/**
 * Move browser focus to the previous/next row registered via
 * `data-row="true"`. Returns true if a focus move happened so the caller
 * can preventDefault on the original key event.
 */
function moveRowFocus(dir: 1 | -1): boolean {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>('[data-row="true"]'),
  );
  if (rows.length === 0) return false;
  const active = document.activeElement as HTMLElement | null;
  const idx = active ? rows.indexOf(active) : -1;
  const next =
    idx === -1
      ? dir === 1
        ? rows[0]
        : rows[rows.length - 1]
      : rows[Math.max(0, Math.min(rows.length - 1, idx + dir))];
  if (next) {
    next.focus();
    next.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  }
  return false;
}

function ShortcutOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-mono text-[12px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-wider">
            Keyboard
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Section title="Move">
            <Row keys={["j", "↓"]}>next row</Row>
            <Row keys={["k", "↑"]}>previous row</Row>
            <Row keys={["o", "↵"]}>open the focused row</Row>
            <Row keys={["esc"]}>close the drawer</Row>
          </Section>
          <Section title="Navigate">
            <Row keys={["g", "n"]}>now</Row>
            <Row keys={["g", "w"]}>work</Row>
            <Row keys={["g", "c"]}>compliance</Row>
            <Row keys={["g", "m"]}>money</Row>
            <Row keys={["g", "i"]}>inbox</Row>
          </Section>
          <Section title="Find">
            <Row keys={["/"]}>command palette</Row>
            <Row keys={["⌘", "K"]}>command palette</Row>
            <Row keys={["?"]}>this overlay</Row>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Row({
  keys,
  children,
}: {
  keys: string[];
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="flex shrink-0 items-baseline gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}
