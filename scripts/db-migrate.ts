/**
 * Apply Drizzle migrations against DATABASE_URL.
 *
 * Run: pnpm --filter web db:migrate
 *
 * After applying SQL migrations, this script also applies the hand-written
 * RLS policies in /db/rls-policies.sql (idempotent).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  // eslint-disable-next-line no-console
  console.log("[db:migrate] applying drizzle migrations…");
  await migrate(db, { migrationsFolder: resolve(root, "db/migrations") });

  // eslint-disable-next-line no-console
  console.log("[db:migrate] applying RLS policies…");
  const rlsSql = readFileSync(resolve(root, "db/rls-policies.sql"), "utf8");
  await client.unsafe(rlsSql);

  await client.end();
  // eslint-disable-next-line no-console
  console.log("[db:migrate] done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
