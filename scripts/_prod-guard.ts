/**
 * Production-write guard (M0 · SEC-006).
 *
 * Any script that can MUTATE a live database must call this first. It refuses to
 * run unless the operator explicitly opts in with STACK_ALLOW_PROD_WRITES=1, so
 * a stray `npx tsx scripts/<x>.ts` can never silently change production data.
 *
 * Never prints secrets. Read-only scripts (audits, verifies) do not need it.
 *
 *   import { assertProdWriteAllowed } from "./_prod-guard";
 *   assertProdWriteAllowed("cancel-all-wos");
 */
export function assertProdWriteAllowed(scriptName: string): void {
  if (process.env.STACK_ALLOW_PROD_WRITES === "1") {
    // eslint-disable-next-line no-console
    console.warn(
      `[prod-guard] "${scriptName}": STACK_ALLOW_PROD_WRITES=1 — proceeding with a production-mutating operation.`,
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.error(
    `[prod-guard] Refusing to run "${scriptName}" — it can mutate production data.\n` +
      `Set STACK_ALLOW_PROD_WRITES=1 to explicitly allow it, e.g.:\n` +
      `  STACK_ALLOW_PROD_WRITES=1 npx tsx scripts/${scriptName}.ts`,
  );
  process.exit(1);
}
