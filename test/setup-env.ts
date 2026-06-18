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

// Tests must never reach real external notification services. The dev
// .env.local carries live keys so `pnpm dev` can actually send; strip them
// here so every channel runs in its documented "unconfigured → stub no-op"
// state. Runs before any test file imports the notification libs. Without
// this, a dispatch with a real recipient makes live HTTP calls (e.g. a Resend
// email) and integration tests hang on the network.
delete process.env.VAPID_PUBLIC_KEY; // web-push
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
delete process.env.RESEND_API_KEY; // email
delete process.env.INNGEST_EVENT_KEY; // force inline dispatch, no event send
delete process.env.TWILIO_ACCOUNT_SID; // SMS
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;
// The single-org pin must NOT apply in tests — they mock Clerk to return
// per-test org ids and assert RLS isolation across orgs. Strip it so the
// auth() wrapper falls back to each test's mocked org.
delete process.env.STACK_ORG_ID;
delete process.env.ALLOWED_OPERATOR_EMAILS;
