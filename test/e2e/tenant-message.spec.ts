import { test, expect } from "@playwright/test";

/**
 * Tenant messaging round-trip: the seeded staff reply is visible, and a tenant
 * message posts and appears. Dev server must run with E2E_BYPASS_AUTH=1.
 */
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test("tenant sees team reply and can post a message", async ({ page }) => {
  const msg = `Thanks — Tuesday morning works ${Date.now()}`;
  await page.goto("/tenant/WO-1013");
  await page.waitForLoadState("networkidle");

  // Staff (Team) reply seeded externally should be visible.
  await expect(page.getByText("we have it scheduled for this week", { exact: false })).toBeVisible();

  await page.getByPlaceholder("Message the team…").fill(msg);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
});
