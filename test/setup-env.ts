/**
 * Vitest setup file — loads /web/.env.local so integration tests can
 * read DATABASE_URL, S3_*, RESEND_*, etc. without the user setting them
 * in the shell.
 *
 * Listed in vitest.config.ts under `test.setupFiles`.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "..", "web", ".env.local");
config({ path: envPath, quiet: true });
