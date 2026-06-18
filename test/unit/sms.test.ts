import { describe, expect, it } from "vitest";
import { smsConfigured, sendSms } from "@/lib/server/sms";

/**
 * SMS delivery guard. Without Twilio configured (the default in tests / local
 * dev / pre-A2P builds — TWILIO_* stripped in setup-env), SMS must degrade to a
 * successful no-op the same way email.ts/push.ts stub — never throw, never
 * block the action that triggered the notification.
 */
describe("Twilio SMS guard", () => {
  it("reports unconfigured when Twilio env is absent", () => {
    expect(smsConfigured()).toBe(false);
  });

  it("sendSms stubs to a successful no-op (id=null) when unconfigured", async () => {
    const r = await sendSms({ to: "+15555550123", body: "New WO-1001 — Bathroom leak" });
    expect(r.id).toBeNull();
  });
});
