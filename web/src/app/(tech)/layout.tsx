import type { Metadata } from "next";
import { TechHeaderActions } from "./_header-actions";

export const metadata: Metadata = {
  title: "Stack · Field",
};

/**
 * Technician field surface (M4). Mobile-first, minimal chrome — no operator
 * rail. Technicians are staff `users`; each page enforces auth + assignment
 * scope via the server layer (`withStaffScope` + assignment checks).
 *
 * This is no longer a technician's *home* (LR-014) — techs land in the console
 * like everyone else. It survives as the one-job field view that notification
 * deep links (`/tech/WO-123` from SMS/push/email) open, so the header carries a
 * way back into the full console — and a sign-out, which this surface never had
 * at all (the operator shell's lives in the account menu / More sheet, neither
 * of which renders here).
 */
export default function TechLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground">
          Stack&nbsp;·&nbsp;Field
        </span>
        <TechHeaderActions />
      </header>
      <main className="mx-auto max-w-md px-4 pb-16 pt-4">{children}</main>
    </div>
  );
}
