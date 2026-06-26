import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Focused capture for the redesign review — viewport shots (no drawer
 * interaction) of the surfaces that matter, so I can evaluate against real
 * pixels. Dev server must run with E2E_BYPASS_AUTH=1.
 */
const OUT = resolve(process.cwd(), process.env.SHOT_DIR ?? "test/screenshots");
mkdirSync(OUT, { recursive: true });

const HIDE = `nextjs-portal,[data-nextjs-dialog-overlay],[data-nextjs-toast]{display:none!important}`;

const SURFACES: [string, string][] = [
  ["/work", "work"],
  ["/my", "my"],
  ["/money", "money"],
  ["/inbox", "inbox"],
  ["/inspections", "inspections"],
  ["/admin/properties", "admin-properties"],
  ["/projects", "projects"],
  ["/compliance", "compliance"],
  ["/work?d=WO-1051", "drawer"],
  ["/work?view=board&type=wo", "board"],
  ["/calendar", "calendar"],
];

for (const [path, name] of SURFACES) {
  test(`shot ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false });
  });
}
