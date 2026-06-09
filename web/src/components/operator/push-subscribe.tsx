"use client";

import * as React from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "stackos.push.dismissedAt";
const COOLDOWN_DAYS = 14;

/**
 * Push-notification opt-in for internal techs. Lives on /my (the surface they
 * live in). Shows a one-tap "Turn on notifications" banner when permission is
 * still default; if already granted, it silently (re)subscribes so a device
 * that cleared its subscription re-registers. Renders nothing when push isn't
 * supported, the VAPID key is absent, or permission was denied.
 */
export function PushSubscribe() {
  const [state, setState] = React.useState<
    "hidden" | "prompt" | "subscribing" | "denied"
  >("hidden");

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY;

  React.useEffect(() => {
    if (!supported) return;

    // Already granted → ensure we have a live subscription, silently.
    if (Notification.permission === "granted") {
      void ensureSubscribed();
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    // default → show the prompt unless recently dismissed.
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
      if (Date.now() - dismissedAt < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    } catch {
      /* ignore */
    }
    setState("prompt");
  }, [supported]);

  if (!supported || state === "hidden" || state === "denied") return null;

  const enable = async () => {
    setState("subscribing");
    const ok = await ensureSubscribed(true);
    if (!ok && Notification.permission === "denied") setState("denied");
    else setState("hidden");
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setState("hidden");
  };

  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card p-3">
      <BellRing className="size-4 shrink-0 text-urgency-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Turn on notifications</p>
        <p className="text-xs text-muted-foreground">
          Get an instant push the moment work is assigned to you — no more
          missed email.
        </p>
      </div>
      <Button size="sm" onClick={enable} disabled={state === "subscribing"}>
        {state === "subscribing" ? "Enabling…" : "Enable"}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Register the SW, request permission if needed, subscribe, and persist to
 * the server. Returns true on success. `interactive` allows the permission
 * prompt (only call from a user gesture).
 */
async function ensureSubscribed(interactive = false): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY) return false;

    if (Notification.permission === "default") {
      if (!interactive) return false;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    } else if (Notification.permission !== "granted") {
      return false;
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const res = await fetch("/api/me/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
