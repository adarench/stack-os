import { describe, expect, it } from "vitest";
import { pushConfigured, sendWebPush } from "@/lib/server/push";

/**
 * Web-push delivery guard. Without VAPID keys configured (the default in
 * tests / local dev / credential-less builds), push must degrade to a
 * successful no-op the same way email.ts stubs — never throw, never block
 * the action that triggered the notification.
 */
describe("web-push VAPID guard", () => {
  it("reports unconfigured when VAPID keys are absent", () => {
    expect(pushConfigured()).toBe(false);
  });

  it("sendWebPush stubs to a successful no-op when unconfigured", async () => {
    const r = await sendWebPush(
      { endpoint: "https://push.example/abc", p256dh: "k", auth: "a" },
      { title: "WO-1001 assigned", body: "Bathroom leak", url: "/work-orders/x" },
    );
    expect(r.ok).toBe(true);
    expect(r.gone).toBe(false);
  });
});
