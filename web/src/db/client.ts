import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// In Node runtime (server actions, Inngest, scripts) we need a WebSocket impl.
// Vercel/edge already provides one.
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

const url = process.env.DATABASE_URL;
if (!url) {
  // eslint-disable-next-line no-console
  console.warn("[db] DATABASE_URL not set — db client created in placeholder mode");
}

export const pool = new Pool({ connectionString: url ?? "postgresql://placeholder" });
export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
