import { type LucideIcon, Construction } from "lucide-react";

/**
 * Temporary placeholder for surfaces not yet built. Replaced by real
 * surface implementation in the corresponding step of the redesign.
 */
export function SurfacePlaceholder({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center px-4 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground" />
      <h1 className="mb-1 text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
