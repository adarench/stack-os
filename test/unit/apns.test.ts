/**
 * APNs guard — with no Apple key configured (the current state everywhere),
 * sendApns must stub to a successful no-op so dispatch never breaks. Goes live
 * only when APNS_KEY/APNS_KEY_ID/APNS_TEAM_ID are set.
 */
import { describe, expect, it } from "vitest";
import { sendApns, apnsConfigured } from "@/lib/server/apns";

describe("APNs guard (stub-until-keyed)", () => {
  it("reports unconfigured when no Apple key is set", () => {
    expect(apnsConfigured()).toBe(false);
  });

  it("stubs to a successful no-op (never throws, never real-sends) when unconfigured", async () => {
    const r = await sendApns("abc123devicetoken", { title: "T", body: "B", url: "/tenant/WO-1", tag: "wo-1" });
    expect(r).toEqual({ ok: true, gone: false });
  });
});
