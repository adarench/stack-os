"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "stackos.installPrompt.dismissedAt";
const COOLDOWN_DAYS = 30;
const SESSION_THRESHOLD = 3;
const SESSION_KEY = "stackos.sessionCount";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Lightweight PWA install banner. Shows once per 30 days, only after the
 * operator has done at least 3 sessions. Listens for `beforeinstallprompt`;
 * does nothing on browsers that don't fire it.
 */
export function InstallPrompt() {
  const [evt, setEvt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = React.useState(false);

  // Track session count.
  React.useEffect(() => {
    try {
      const count = Number(localStorage.getItem(SESSION_KEY) ?? "0") + 1;
      localStorage.setItem(SESSION_KEY, String(count));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);

      try {
        const dismissedAt = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
        const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        const sessions = Number(localStorage.getItem(SESSION_KEY) ?? "0");
        if (Date.now() - dismissedAt < cooldownMs) return;
        if (sessions < SESSION_THRESHOLD) return;
      } catch {
        /* ignore */
      }
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || !evt) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const install = async () => {
    await evt.prompt();
    await evt.userChoice;
    dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-16 z-40 flex items-center gap-2 rounded-md border border-border bg-card p-3 shadow-lg md:bottom-3 md:left-auto md:right-3 md:max-w-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Install Stack OS</p>
        <p className="text-xs text-muted-foreground">
          Get a faster app-like experience and home-screen access.
        </p>
      </div>
      <Button size="sm" onClick={install}>
        Install
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
