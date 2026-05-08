export { inngest } from "./client";

import { healthPing } from "./functions/health";
import { spawnFromTemplates } from "./functions/spawn-from-templates";
import { dispatchNotification } from "./functions/dispatch-notification";
import { complianceSweep } from "./functions/compliance-sweep";

export { healthPing, spawnFromTemplates, dispatchNotification, complianceSweep };

export const functions = [
  healthPing,
  spawnFromTemplates,
  dispatchNotification,
  complianceSweep,
] as const;
