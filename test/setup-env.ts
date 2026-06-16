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

// Tests must never reach real web-push services (Apple/Google/Mozilla). The
// dev .env.local now carries VAPID keys so `pnpm dev` can actually send push;
// strip them here so the test process runs in the documented "unconfigured →
// stub no-op" state. Runs before any test file imports lib/server/push.ts.
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
