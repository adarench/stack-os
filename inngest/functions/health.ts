import { inngest } from "../client";

/**
 * No-op function used to verify Inngest wiring in P0.
 * P3 replaces with real recurring/notification handlers.
 */
export const healthPing = inngest.createFunction(
  { id: "health-ping" },
  { event: "stack-os/health.ping" },
  async ({ event }) => {
    return { ok: true, receivedAt: new Date().toISOString(), payload: event.data };
  },
);
