import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * PWA manifest baseline validation (M0).
 *
 * Locks the manifest baseline and guards against broken references. It does NOT
 * assert installability: at the M0 baseline `icons` is intentionally empty, so
 * the app is not installable — adding branded icons + an offline service worker
 * + global registration is M7 (PWA-001/002/004, a launch gate). See
 * docs/lucid-rollout/REQUIREMENTS_TRACKER.md.
 */
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/public");
const manifest = JSON.parse(readFileSync(path.join(PUBLIC, "manifest.webmanifest"), "utf8"));

describe("PWA manifest baseline", () => {
  it("is valid JSON with the required baseline fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(typeof manifest.start_url).toBe("string");
    expect(manifest.start_url.startsWith("/")).toBe(true);
    expect(["standalone", "fullscreen", "minimal-ui", "browser"]).toContain(manifest.display);
  });

  it("declares an icons array (empty until M7 — do NOT infer installability)", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  it("every icon it references resolves to a real file (no broken references)", () => {
    for (const icon of manifest.icons ?? []) {
      const rel = String(icon.src).replace(/^\//, "");
      expect(existsSync(path.join(PUBLIC, rel))).toBe(true);
    }
  });

  it("referenced service workers exist on disk", () => {
    expect(existsSync(path.join(PUBLIC, "sw.js"))).toBe(true);
    expect(existsSync(path.join(PUBLIC, "tenant-sw.js"))).toBe(true);
  });
});
