import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stack · Field",
};

/**
 * Technician field surface (M4). Mobile-first, minimal chrome — no operator
 * rail. Technicians are staff `users`; each page enforces auth + assignment
 * scope via the server layer (`withStaffScope` + assignment checks).
 */
export default function TechLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground">
          Stack&nbsp;·&nbsp;Field
        </span>
      </header>
      <main className="mx-auto max-w-md px-4 pb-16 pt-4">{children}</main>
    </div>
  );
}
