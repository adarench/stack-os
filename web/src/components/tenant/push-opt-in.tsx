"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

/**
 * Push opt-in prompt — only renders when push is available but not yet on.
 * Registers the tenant service worker, requests permission, subscribes with
 * the VAPID key, and posts the subscription to the tenant subscribe route.
 */
export function PushOptIn() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      !VAPID
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setState(sub ? "on" : "off");
      })
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    if (!VAPID) return;
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/tenant-sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const json = sub.toJSON();
      await fetch("/api/tenant/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("on");
    } catch {
      setState("off");
    }
  }

  if (state === "loading" || state === "unsupported" || state === "on") return null;

  return (
    <button
      type="button"
      onClick={enable}
      disabled={state === "busy" || state === "denied"}
      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
    >
      <Bell className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex-1">
        <span className="block text-body font-medium text-foreground">
          Turn on notifications
        </span>
        <span className="block text-label text-muted-foreground">
          {state === "denied"
            ? "Blocked in your browser settings."
            : "Get an alert when we reply or schedule a visit."}
        </span>
      </span>
      {state === "busy" && <span className="text-label text-muted-foreground">…</span>}
    </button>
  );
}
