export { inngest } from "./client";
export { healthPing } from "./functions/health";

import { healthPing } from "./functions/health";

export const functions = [healthPing] as const;
