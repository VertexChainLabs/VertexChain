#!/usr/bin/env node
/**
 * bundle-budget.mjs — Codify a bundle-size budget for the VertexChain frontend.
 *
 * Reads the Next.js build manifest from `.next/build-manifest.json` and
 * `.next/export-marker.json` (or a standalone build trace) and asserts:
 *   1. Total initial JS+CSS ≤ 250 kB
 *   2. No individual route chunk > 100 kB
 *
 * Writes a machine-readable `bundle-budget.json` alongside the build output
 * so CI can diff it across commits for visual inspection.
 *
 * Usage:
 *   node scripts/bundle-budget.mjs [--strict]
 *
 * Exit code 0 on pass, exit code 1 on budget violation, exit code 2 on
 * missing build output (run `next build` first).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NEXT_DIR = path.join(ROOT, ".next");
const STRICT = process.argv.includes("--strict");

// ---------------------------------------------------------------------------
// Budget thresholds
// ---------------------------------------------------------------------------

const TOTAL_INITIAL_BUDGET_BYTES = 250 * 1024; // 250 kB
const ROUTE_BUDGET_BYTES = 100 * 1024; // 100 kB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`❌ BUNDLE BUDGET VIOLATION: ${msg}`);
  process.exit(1);
}

/**
 * Returns size in bytes of `filePath`. Returns 0 for missing / non-regular
 * files so the script gracefully handles optional build artefacts.
 */
function trySize(filePath) {
  try {
    return fs.statSync(filePath)?.isFile() ? fs.statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

/**
 * Aggressively walk a directory for `.js` and `.css` files, returning a
 * flat `Map<relativePath, bytes>`.
 */
function walkDir(dir, map = new Map()) {
  if (!fs.existsSync(dir)) return map;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, map);
    } else if (/\.(js|css)$/.test(entry.name)) {
      map.set(path.relative(ROOT, full), fs.statSync(full).size);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // 1. Assert build output exists
  if (!fs.existsSync(NEXT_DIR)) {
    console.error(
      "No `.next` directory found. Run `next build` before checking the bundle budget.",
    );
    process.exit(2);
  }

  const report = {
    timestamp: new Date().toISOString(),
    budgets: {
      totalInitialBytes: TOTAL_INITIAL_BUDGET_BYTES,
      routeBytes: ROUTE_BUDGET_BYTES,
    },
    routes: {},
    totals: { js: 0, css: 0 },
    violations: [],
    passed: true,
  };

  // 2. Gather all static JS + CSS artefacts
  const staticDir = path.join(NEXT_DIR, "static");
  const allFiles = walkDir(staticDir);

  // 3. Compute route-level sizes from chunks/
  const chunksDir = path.join(staticDir, "chunks");
  const pagesDir = path.join(chunksDir, "pages");

  // Scan route chunks
  if (fs.existsSync(pagesDir)) {
    for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) continue;
      const full = path.join(pagesDir, entry.name);
      const size = fs.statSync(full).size;
      const route = entry.name.replace(/\.(js|css)$/, "");

      report.routes[route] = (report.routes[route] || 0) + size;

      if (/\.js$/.test(entry.name)) report.totals.js += size;
      if (/\.css$/.test(entry.name)) report.totals.css += size;
    }
  }

  // 4. Add framework / shared chunks to totals
  for (const [rel, size] of allFiles) {
    if (rel.includes("chunks/pages")) continue; // already counted
    if (/\.js$/.test(rel)) report.totals.js += size;
    if (/\.css$/.test(rel)) report.totals.css += size;
  }

  const totalInitial = report.totals.js + report.totals.css;

  // 5. Check total budget
  if (totalInitial > TOTAL_INITIAL_BUDGET_BYTES) {
    report.violations.push(
      `Total initial JS+CSS ${(totalInitial / 1024).toFixed(1)} kB exceeds budget of ${(TOTAL_INITIAL_BUDGET_BYTES / 1024).toFixed(0)} kB`,
    );
    report.passed = false;
  }

  // 6. Check per-route budget
  for (const [route, size] of Object.entries(report.routes)) {
    if (size > ROUTE_BUDGET_BYTES) {
      report.violations.push(
        `Route "${route}" ${(size / 1024).toFixed(1)} kB exceeds route budget of ${(ROUTE_BUDGET_BYTES / 1024).toFixed(0)} kB`,
      );
      report.passed = false;
    }
  }

  // 7. Write machine-readable report
  const reportPath = path.join(NEXT_DIR, "bundle-budget.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // 8. Human-friendly summary
  console.log("\n📦 Bundle Budget Report");
  console.log("═══════════════════════");
  console.log(`  Total JS:   ${(report.totals.js / 1024).toFixed(1)} kB`);
  console.log(`  Total CSS:  ${(report.totals.css / 1024).toFixed(1)} kB`);
  console.log(`  Combined:   ${(totalInitial / 1024).toFixed(1)} kB (budget: ${(TOTAL_INITIAL_BUDGET_BYTES / 1024).toFixed(0)} kB)`);
  console.log("");

  if (Object.keys(report.routes).length > 0) {
    console.log("  Per-route sizes (budget: 100 kB):");
    for (const [route, size] of Object.entries(report.routes).sort()) {
      const pct = ((size / ROUTE_BUDGET_BYTES) * 100).toFixed(0);
      const bar = "█".repeat(Math.min(Math.round(size / ROUTE_BUDGET_BYTES * 20), 20));
      const flag = size > ROUTE_BUDGET_BYTES ? " ❌" : " ✅";
      console.log(`    ${route.padEnd(30)} ${(size / 1024).toFixed(1).padStart(7)} kB  ${bar}${flag}`);
    }
  }

  if (report.passed) {
    console.log("\n✅ All bundle budgets passed.");
    console.log(`   Report written to ${reportPath}`);
  } else {
    console.log(`\n❌ ${report.violations.length} budget violation(s) found.`);
    for (const v of report.violations) console.log(`   • ${v}`);
    console.log(`\n   Report written to ${reportPath}`);
    process.exit(1);
  }
}

main();
