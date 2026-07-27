"use client";

import { useEffect } from "react";

/**
 * Global service-worker registration (PWA-004 — installability).
 *
 * Registers a SW on every load — not just when a user opts into push — which is
 * what makes the app installable and gives it the offline shell. The tenant
 * surface uses its own SW (tenant deep links + its own precache); every other
 * surface uses the operator/app SW. Both register at root scope and share push
 * + offline behavior. Failure is non-fatal: the app works fine online without a
 * SW, so we swallow errors rather than surface them.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const script = window.location.pathname.startsWith("/tenant")
      ? "/tenant-sw.js"
      : "/sw.js";

    const register = () => {
      navigator.serviceWorker.register(script, { scope: "/" }).catch(() => {
        /* non-fatal — online still works without a service worker */
      });
    };

    // Defer past first paint so SW install doesn't compete with initial render.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
