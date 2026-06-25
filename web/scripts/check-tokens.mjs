#!/usr/bin/env node
/**
 * Token-discipline gate. Fails if any source file (outside globals.css) uses a
 * raw Tailwind palette literal instead of the semantic tokens. This is the
 * rule that stops the "two-world" regression the design audit found — once the
 * redesign migration reaches zero, wire it into CI / the lint script.
 *
 *   node scripts/check-tokens.mjs          # report + exit 1 if any remain
 *   node scripts/check-tokens.mjs --quiet  # just the count
 *
 * It is intentionally NOT part of `next lint` yet: during the staged migration
 * the legacy screens still trip it, and we don't want that to block the
 * per-wave build gate. It tracks burn-down instead.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const QUIET = process.argv.includes("--quiet");

const PALETTE =
  "zinc|gray|neutral|slate|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PROPS =
  "bg|text|border|ring|ring-offset|from|via|to|fill|stroke|divide|outline|placeholder|caret|accent|decoration|shadow";
const BANNED = new RegExp(`\\b(${PROPS})-(${PALETTE})-(\\d{2,3})\\b`);

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entry)) continue;
    if (entry === "globals.css") continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => {
      const m = line.match(BANNED);
      if (m) offenders.push({ file: relative(ROOT, full), line: i + 1, hit: m[0] });
    });
  }
}

walk(ROOT);

const fileCount = new Set(offenders.map((o) => o.file)).size;

if (offenders.length === 0) {
  console.log("✓ token discipline: 0 raw palette literals outside globals.css");
  process.exit(0);
}

if (!QUIET) {
  const byFile = new Map();
  for (const o of offenders) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
  for (const [file, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${file}`);
  }
}
console.log(
  `\n✗ token discipline: ${offenders.length} raw palette literals across ${fileCount} files`,
);
process.exit(1);
