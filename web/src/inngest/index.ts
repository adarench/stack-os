export { inngest } from "./client";

import { healthPing } from "./functions/health";
import { spawnFromTemplates } from "./functions/spawn-from-templates";
import { dispatchNotification } from "./functions/dispatch-notification";

export { healthPing, spawnFromTemplates, dispatchNotification };

export const functions = [
  healthPing,
  spawnFromTemplates,
  dispatchNotification,
] as const;
