import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * PWA installability validation (M7 — PWA-001/002/004).
 *
 * At M0 the manifest had no icons (not installable). M7 adds the branded icon
 * set, an offline service worker, and global registration. These tests lock the
 * installability contract: required manifest fields, a 192 + 512 icon that
 * Chrome needs, a maskable icon for Android, an iOS apple-touch-icon, and an
 * offline fallback the SWs precache. On-device install + push still require
 * real devices + VAPID keys (the remaining launch-gate step).
 */
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/public");
const manifest = JSON.parse(readFileSync(path.join(PUBLIC, "manifest.webmanifest"), "utf8"));

function fileExists(rel: string): boolean {
  return existsSync(path.join(PUBLIC, String(rel).replace(/^\//, "")));
}

describe("PWA manifest baseline", () => {
  it("is valid JSON with the required baseline fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(typeof manifest.start_url).toBe("string");
    expect(manifest.start_url.startsWith("/")).toBe(true);
    expect(["standalone", "fullscreen", "minimal-ui", "browser"]).toContain(manifest.display);
  });

  it("every icon it references resolves to a real file (no broken references)", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(fileExists(icon.src), `${icon.src} should exist`).toBe(true);
    }
  });

  it("referenced service workers exist on disk", () => {
    expect(existsSync(path.join(PUBLIC, "sw.js"))).toBe(true);
    expect(existsSync(path.join(PUBLIC, "tenant-sw.js"))).toBe(true);
  });
});

describe("PWA installability (M7)", () => {
  const bySize = (s: string) =>
    manifest.icons.find((i: { sizes: string }) => i.sizes === s);

  it("declares the 192 + 512 icons Chrome requires for install", () => {
    expect(bySize("192x192"), "192x192 icon").toBeTruthy();
    expect(bySize("512x512"), "512x512 icon").toBeTruthy();
    expect(fileExists(bySize("192x192").src)).toBe(true);
    expect(fileExists(bySize("512x512").src)).toBe(true);
  });

  it("declares a maskable icon for Android adaptive icons", () => {
    const maskable = manifest.icons.find((i: { purpose?: string }) =>
      (i.purpose ?? "").split(/\s+/).includes("maskable"),
    );
    expect(maskable, "a maskable-purpose icon").toBeTruthy();
    expect(fileExists(maskable.src)).toBe(true);
  });

  it("ships an iOS apple-touch-icon", () => {
    expect(fileExists("/icons/apple-touch-icon-180.png")).toBe(true);
  });

  it("ships an offline fallback the service workers precache", () => {
    expect(existsSync(path.join(PUBLIC, "offline.html"))).toBe(true);
    for (const sw of ["sw.js", "tenant-sw.js"]) {
      const src = readFileSync(path.join(PUBLIC, sw), "utf8");
      expect(src, `${sw} should handle fetch for offline`).toContain("addEventListener(\"fetch\"");
      expect(src, `${sw} should precache offline.html`).toContain("/offline.html");
    }
  });
});
