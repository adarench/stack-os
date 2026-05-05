/**
 * Seed minimal data for local dev and Day-3 validation.
 *
 * Run: pnpm --filter web db:seed
 *
 * P0 stub: just verifies db connectivity. P1 will populate
 * 5 properties / 20 units / 3 vendors per the 72-hour plan.
 */
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.warn("[db:seed] DATABASE_URL not set — skipping (P0 stub).");
    return;
  }
  // eslint-disable-next-line no-console
  console.log("[db:seed] DATABASE_URL detected — P0 stub, no rows inserted yet.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
