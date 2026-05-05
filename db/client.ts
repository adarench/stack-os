import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Allow tooling/typecheck to load without a live connection.
  // Runtime callers MUST set DATABASE_URL.
  // eslint-disable-next-line no-console
  console.warn("[db] DATABASE_URL not set — db client created in placeholder mode");
}

const sql = neon(url ?? "postgresql://placeholder");
export const db = drizzle(sql, { schema });

export type DB = typeof db;
export { schema };
