export const FINDING_SEVERITIES = ["info", "observation", "actionable", "critical"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/** Severities that, when paired with `pass=false`, spawn a WO at completion. */
export const SPAWNABLE_SEVERITIES: readonly FindingSeverity[] = ["actionable", "critical"];

export function shouldSpawnWorkOrder(args: { severity: FindingSeverity; pass: boolean }): boolean {
  if (args.pass) return false;
  return SPAWNABLE_SEVERITIES.includes(args.severity);
}
