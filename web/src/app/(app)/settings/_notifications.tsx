"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setChannelPrefAction } from "./_actions";
import type { ChannelPref } from "@/lib/server/notification-prefs";

const CHANNEL_LABELS: Record<string, { label: string; hint: string }> = {
  email: { label: "Email", hint: "Work-order updates to your inbox" },
  sms: { label: "Text message", hint: "Key events by SMS (needs a phone on file)" },
  push: { label: "Push", hint: "Browser / installed-app notifications" },
};

/**
 * Per-channel opt-out toggles for the signed-in staff member. The in-app inbox
 * is always on and not shown here — this controls only the pushed channels.
 */
export function NotificationSettings({ initial }: { initial: ChannelPref[] }) {
  const [prefs, setPrefs] = React.useState(initial);
  const [pending, setPending] = React.useState<string | null>(null);

  const toggle = (channel: string, next: boolean) => {
    const prev = prefs;
    setPrefs((p) => p.map((c) => (c.channel === channel ? { ...c, enabled: next } : c)));
    setPending(channel);
    void (async () => {
      const r = await setChannelPrefAction({ channel: channel as ChannelPref["channel"], enabled: next });
      setPending(null);
      if (!r.ok) {
        setPrefs(prev); // roll back on failure
        toast.error(`Couldn't save: ${r.error}`);
      } else {
        toast.success(next ? "Turned on" : "Turned off");
      }
    })();
  };

  return (
    <ul className="divide-y divide-border/50">
      {prefs.map((c) => {
        const meta = CHANNEL_LABELS[c.channel] ?? { label: c.channel, hint: "" };
        return (
          <li key={c.channel} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{meta.label}</p>
              <p className="text-meta text-muted-foreground">{meta.hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={c.enabled}
              aria-label={`${meta.label} notifications`}
              disabled={pending === c.channel}
              onClick={() => toggle(c.channel, !c.enabled)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                c.enabled ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
                  c.enabled ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
