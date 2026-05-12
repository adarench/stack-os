"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the server by calling `router.refresh()` on a fixed interval and
 * when the tab regains focus. Server components on the active surface
 * re-fetch and re-render with fresh data. Drop into a list surface to get
 * focus-revalidation + interval polling without rewriting it as client.
 *
 *   <AutoRefresh intervalMs={15_000} />
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    let mounted = true;

    const refresh = () => {
      if (!mounted) return;
      if (document.hidden) return;
      router.refresh();
    };

    const id = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
