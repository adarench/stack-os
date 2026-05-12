"use client";

import * as React from "react";

/**
 * Tiny "Live" chip: pulsing green dot + label. Says the surface is being
 * polled. The actual polling is handled by `<AutoRefresh />`; this is the
 * visible signal.
 *
 *   <LiveIndicator />
 */
export function LiveIndicator() {
  // Render only client-side so SSR doesn't flash "Live" before hydration
  // when the auto-refresh hasn't yet had a chance to fire.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <span className="relative inline-flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-urgency-done opacity-70" />
        <span className="relative inline-block size-2 rounded-full bg-urgency-done" />
      </span>
      Live
    </span>
  );
}
