import { defineConfig, devices } from "@playwright/test";

/**
 * Headless-screenshot config. The dev server is expected to run with
 * E2E_BYPASS_AUTH=1 so Clerk is short-circuited and the seeded prod org
 * renders directly. Run:
 *
 *   E2E_BYPASS_AUTH=1 pnpm --filter web dev
 *   pnpm exec playwright test --reporter=line
 *
 * Specs live in /test/e2e; output (screenshots) lands in /test/screenshots.
 */
export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  reporter: "line",
  timeout: 60_000,
  use: {
    baseURL: process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
