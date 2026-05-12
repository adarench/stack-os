"use client";

import * as React from "react";
import { X } from "lucide-react";

const KEY = "stackos.cutover.dismissed";

/**
 * One-time post-cutover banner. Surfaced once per browser per user via
 * localStorage; dismissible. Replace with a release-note link once
 * onboarding flow has its own spot.
 */
export function CutoverBanner() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="sticky top-11 z-20 flex items-center gap-2 border-b border-urgency-brand/30 bg-urgency-brand/5 px-3 py-1.5 text-xs">
      <span className="font-medium">New Stack OS.</span>
      <span className="text-muted-foreground">
        Press{" "}
        <kbd className="rounded border border-border bg-background px-1 font-mono">
          ⌘K
        </kbd>{" "}
        to jump anywhere · old links keep working during cutover.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="ml-auto inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
