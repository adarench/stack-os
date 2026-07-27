/**
 * Generate the PWA icon set (PWA-001 — installability) with zero image deps.
 *
 * Pure-Node PNG encoder (zlib + hand-rolled CRC32) draws the Stack mark: a dark
 * rounded square with three white "stack" bars. Emits the sizes browsers need
 * to treat the app as installable (Chrome: 192 + 512; a maskable 512 for
 * Android adaptive icons; a 180 apple-touch-icon for iOS home-screen).
 *
 *   node scripts/gen-pwa-icons.mjs      # writes web/public/icons/*.png
 *
 * Re-run after changing the brand colors/mark below; commit the PNGs.
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web", "public", "icons");

const INK = [10, 10, 10, 255]; // #0a0a0a — brand background (matches theme_color)
const MARK = [245, 245, 245, 255]; // near-white bars
const CLEAR = [0, 0, 0, 0];

// ---- PNG encoding -------------------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- drawing ------------------------------------------------------------
function canvas(size, bg) {
  const b = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) b.set(bg, i * 4);
  return b;
}
function px(buf, size, x, y, c) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  buf.set(c, (y * size + x) * 4);
}
function roundRect(buf, size, x0, y0, w, h, r, c) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      let inside = true;
      const dxl = x - (x0 + r);
      const dxr = x - (x0 + w - 1 - r);
      const dyt = y - (y0 + r);
      const dyb = y - (y0 + h - 1 - r);
      if (x < x0 + r && y < y0 + r) inside = dxl * dxl + dyt * dyt <= r * r;
      else if (x > x0 + w - 1 - r && y < y0 + r) inside = dxr * dxr + dyt * dyt <= r * r;
      else if (x < x0 + r && y > y0 + h - 1 - r) inside = dxl * dxl + dyb * dyb <= r * r;
      else if (x > x0 + w - 1 - r && y > y0 + h - 1 - r) inside = dxr * dxr + dyb * dyb <= r * r;
      if (inside) px(buf, size, x, y, c);
    }
  }
}

/**
 * @param size icon dimension
 * @param maskable full-bleed bg + bars inside the 80% safe zone (Android mask)
 * @param opaque  bg fills the whole square (no transparent corners — iOS)
 */
function drawIcon(size, { maskable = false, opaque = false } = {}) {
  const buf = canvas(size, maskable || opaque ? INK : CLEAR);
  if (!maskable && !opaque) {
    // rounded-square brand tile on a transparent field
    roundRect(buf, size, 0, 0, size, size, Math.round(size * 0.22), INK);
  }
  // three stacked bars, centered; tighter footprint when maskable (safe zone)
  const markW = maskable ? 0.5 : 0.56;
  const barW = Math.round(size * markW);
  const x0 = Math.round((size - barW) / 2);
  const barH = Math.round(size * 0.1);
  const gap = Math.round(size * 0.07);
  const totalH = barH * 3 + gap * 2;
  let y = Math.round((size - totalH) / 2);
  const r = Math.round(barH / 2);
  for (let i = 0; i < 3; i++) {
    roundRect(buf, size, x0, y, barW, barH, r, MARK);
    y += barH + gap;
  }
  return encodePng(size, buf);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ["icon-192.png", drawIcon(192)],
  ["icon-512.png", drawIcon(512)],
  ["icon-maskable-512.png", drawIcon(512, { maskable: true })],
  ["apple-touch-icon-180.png", drawIcon(180, { opaque: true })],
];
for (const [name, buf] of files) {
  writeFileSync(resolve(OUT, name), buf);
  // eslint-disable-next-line no-console
  console.log(`wrote ${name} (${buf.length} bytes)`);
}
