import { test, expect } from "@playwright/test";

/**
 * End-to-end proof of the tenant write path: submit a request and confirm it
 * reads back on the home (system-scope insert → tenant RLS read). Dev server
 * must run with E2E_BYPASS_AUTH=1.
 */
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test("tenant can submit a request and see it on home", async ({ page }) => {
  const title = `E2E faucet drip ${Date.now()}`;
  await page.goto("/tenant/new");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Plumbing" }).click();
  await page.getByPlaceholder("e.g. Kitchen sink is leaking").fill(title);
  await page.getByRole("button", { name: "Submit request" }).click();

  await page.waitForURL("**/tenant", { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
});
