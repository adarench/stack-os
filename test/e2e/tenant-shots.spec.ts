import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Tenant mobile app capture (phone viewport). Dev server must run with
 * E2E_BYPASS_AUTH=1 (pins the seeded marcus.webb tenant).
 */
const OUT = resolve(process.cwd(), process.env.SHOT_DIR ?? "test/screenshots");
mkdirSync(OUT, { recursive: true });

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const HIDE = `nextjs-portal,[data-nextjs-dialog-overlay],[data-nextjs-toast]{display:none!important}`;

const SURFACES: [string, string][] = [
  ["/tenant", "tenant-home"],
  ["/tenant/new", "tenant-new"],
  ["/tenant/insurance", "tenant-insurance"],
  ["/tenant/WO-1013", "tenant-detail"],
];

for (const [path, name] of SURFACES) {
  test(`shot ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false });
  });
}
