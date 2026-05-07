import { inngest } from "../client";
import { runDueTemplates } from "@/lib/server/templates";

/**
 * Hourly cron that fires due `task_templates` and spawns `work_orders`.
 *
 * Idempotency: spawnOnce dedupes on (template_id, fire_at), so re-runs of
 * the same period are no-ops.
 */
export const spawnFromTemplates = inngest.createFunction(
  { id: "spawn-from-templates" },
  { cron: "0 * * * *" }, // top of every hour, UTC
  async ({ step }) => {
    const result = await step.run("scan-and-spawn", async () => {
      const r = await runDueTemplates();
      return r;
    });
    return result;
  },
);
