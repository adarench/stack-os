"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";

/**
 * Browser-online state chip. Renders in the corner when offline so the
 * operator knows write actions will fail. v1 does not queue mutations —
 * the chip is purely informational.
 */
export function OfflineIndicator() {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-12 z-40 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-urgency-overdue px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white shadow"
    >
      <WifiOff className="size-3" />
      Offline — read only
    </div>
  );
}
