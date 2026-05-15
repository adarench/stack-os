import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "test/screenshots");
mkdirSync(OUT, { recursive: true });

/**
 * Walks every operator surface and captures both the page and (where
 * applicable) the entity drawer open over it. The dev server must be
 * running with E2E_BYPASS_AUTH=1 so Clerk short-circuits to Adam's
 * seeded org.
 */

const SURFACES = [
  { path: "/now", name: "01-now" },
  { path: "/work", name: "02-work" },
  { path: "/compliance", name: "03-compliance" },
  { path: "/money", name: "04-money-approvals" },
  { path: "/money?tab=invoices", name: "05-money-invoices" },
  { path: "/inbox", name: "06-inbox" },
] as const;

// Hide Clerk's dev-mode "Keyless prompt" overlay + Next's dev tools so
// screenshots show only the operator surface.
const HIDE_DEV_CHROME = `
  [aria-label="Keyless prompt"],
  [aria-controls=":r1:"],
  /* The whole overlay wrapper Clerk inserts at <body> root */
  body > div[class*="cl-internal-"],
  /* Next dev error overlay */
  nextjs-portal, [data-nextjs-dialog-overlay] {
    display: none !important;
  }
  /* The parent button when expanded has a panel sibling — kill ancestor */
  div:has(> [aria-label="Keyless prompt"]) {
    display: none !important;
  }
`;

for (const surface of SURFACES) {
  test(`captures ${surface.name}`, async ({ page }) => {
    await page.goto(surface.path);
    // Allow the activity strip / TimeSince ticker to settle.
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: HIDE_DEV_CHROME });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: resolve(OUT, `${surface.name}.png`),
      fullPage: true,
    });
  });
}

test("captures drawer open on a WO from /now", async ({ page }) => {
  await page.goto("/now");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: HIDE_DEV_CHROME });
  // The overdue lane is canonical WO content. Pick the first WO-row there
  // by matching the row whose monospace ref starts with WO-.
  const woRefCell = page.locator("span", { hasText: /^WO-\d+$/ }).first();
  await woRefCell.click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: resolve(OUT, "07-drawer-wo.png"),
    fullPage: false,
  });
});

test("captures WO drawer timeline + composer", async ({ page }) => {
  await page.goto("/now");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: HIDE_DEV_CHROME });
  const woRefCell = page.locator("span", { hasText: /^WO-\d+$/ }).first();
  await woRefCell.click();
  await page.waitForTimeout(1200);
  await page.click("button[role=tab]:has-text('Timeline')");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: resolve(OUT, "09-drawer-wo-timeline.png"),
    fullPage: false,
  });
});

test("captures drawer open on an approval from /now", async ({ page }) => {
  await page.goto("/now");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: HIDE_DEV_CHROME });
  const approvalRow = page
    .locator('[role="button"]', { hasText: /AP-/ })
    .first();
  if (await approvalRow.count() === 0) {
    test.skip(true, "No approval visible on /now — seed may need a refresh.");
  }
  await approvalRow.click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: resolve(OUT, "08-drawer-approval.png"),
    fullPage: false,
  });
});
