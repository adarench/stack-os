/**
 * Apply only the RLS policies (without running drizzle migrations).
 * Useful when iterating on /db/rls-policies.sql.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __script_dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__script_dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__script_dir, "..", "web", ".env"), quiet: true });
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = postgres(url, { max: 1 });
  const sql = readFileSync(resolve(root, "web/src/db/rls-policies.sql"), "utf8");
  await client.unsafe(sql);
  await client.end();
  // eslint-disable-next-line no-console
  console.log("[db:rls:apply] done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
