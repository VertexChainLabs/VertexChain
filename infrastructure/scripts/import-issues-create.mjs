#!/usr/bin/env node
/**
 * Create GitHub issues for VertexChainLabs/VertexChain from a JSON document
 * produced by `import-issues.mjs`. Idempotent — re-running skips already-
 * created issues by reading the output log file.
 *
 * Usage:
 *   node infrastructure/scripts/import-issues-create.mjs --dry-run
 *   node infrastructure/scripts/import-issues-create.mjs --repo VertexChainLabs/VertexChain
 *   node infrastructure/scripts/import-issues-create.mjs --start 50  # resume from #50
 *
 * Exit code 0 if all targeted issues were created/skipped successfully.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const DEFAULTS = {
  json: "/tmp/import/issues.json",
  repo: "VertexChainLabs/VertexChain",
  log: "/tmp/import/created.jsonl",
  labelsLog: "/tmp/import/labels.json",
  start: 1,
  end: 100,
  limit: null,
  dryRun: false,
  dryRunPreview: 3,
};

// ---------- argument parsing ----------
function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--json") out.json = argv[++i];
    else if (flag === "--repo") out.repo = argv[++i];
    else if (flag === "--log") out.log = argv[++i];
    else if (flag === "--labels-log") out.labelsLog = argv[++i];
    else if (flag === "--start") out.start = parseInt(argv[++i], 10);
    else if (flag === "--end") out.end = parseInt(argv[++i], 10);
    else if (flag === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (flag === "--dry-run") out.dryRun = true;
    else if (flag === "--help" || flag === "-h") {
      console.log(
        "Usage: node import-issues-create.mjs [--json <path>] [--repo <owner/repo>] " +
          "[--log <path>] [--labels-log <path>] [--start <n>] [--end <n>] " +
          "[--limit <n>] [--dry-run]",
      );
      process.exit(0);
    }
  }
  if (
    !Number.isInteger(out.start) ||
    out.start < 1 ||
    !Number.isInteger(out.end) ||
    out.end < out.start ||
    (out.limit != null && (!Number.isInteger(out.limit) || out.limit < 1))
  ) {
    console.error(
      `Invalid numeric arg: --start=${out.start} --end=${out.end} --limit=${out.limit}`,
    );
    process.exit(1);
  }
  return out;
}

// ---------- shell helpers ----------
function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(cmd, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (b) => (stdout += b.toString()));
    child.stderr?.on("data", (b) => (stderr += b.toString()));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      resolve({ code, stdout, stderr });
    });
  });
}

/** Stable hex color from a label name so labels are visually consistent. */
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const r = (h >> 16) & 0xff;
  const g = (h >> 8) & 0xff;
  const b = h & 0xff;
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Map a label to a richer description based on common substrings. */
function describeFor(name) {
  const map = {
    "good first issue":
      "Suitable for first-time contributors to this repository.",
    "good first review":
      "Worth a closer read from a reviewer; not necessarily a first-time task.",
    "needs-spec":
      "Requires a written design/acceptance spec before implementation.",
    "ok for first PR":
      "Small, low-risk change suitable for a first pull request.",
  };
  return map[name] || `Imported from docs/ISSUES_100.md (label \"${name}\").`;
}

// ---------- main ----------
async function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(opts.json)) {
    console.error(`JSON file not found: ${opts.json}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(opts.json, "utf8"));
  let issues = data.issues.filter(
    (i) => i.number >= opts.start && i.number <= opts.end,
  );
  if (opts.limit != null) issues = issues.slice(0, opts.limit);
  if (issues.length === 0) {
    console.error(
      `No issues in range [${opts.start}, ${opts.end}] — check --start/--end.`,
    );
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(
      `DRY RUN: would create ${issues.length} issues + ${data.labels.length} labels on ${opts.repo}.`,
    );
    for (const i of issues.slice(0, opts.dryRunPreview)) {
      console.log(`\n--- #${i.number} ---`);
      console.log(`title:  ${i.title}`);
      console.log(`labels: ${i.labels.join(", ") || "(none)"}`);
      console.log(`body excerpt:`);
      console.log(
        i.body
          .split("\n")
          .slice(0, 8)
          .map((line) => "  | " + line)
          .join("\n"),
      );
    }
    if (issues.length > opts.dryRunPreview) {
      console.log(
        `\n…${issues.length - opts.dryRunPreview} more issues not shown.`,
      );
    }
    console.log(`\nLog file:        ${opts.log}`);
    console.log(`Labels log file: ${opts.labelsLog}`);
    process.exit(0);
  }

  // Load resumability state. We dedupe by `sourceNumber` (the issue's
  // position in `docs/ISSUES_100.md`, 1..100). Reading `number` here would
  // be wrong because `number` is the GitHub-assigned number, which can
  // collide with another source number in the doc (e.g. GitHub #92 from
  // the pilot is also doc source #92).
  const alreadyCreated = new Set();
  if (fs.existsSync(opts.log)) {
    for (const line of fs.readFileSync(opts.log, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        const key = typeof r?.sourceNumber === "number" ? r.sourceNumber : null;
        if (key != null) alreadyCreated.add(key);
      } catch {
        /* skip malformed lines */
      }
    }
  }
  const labelsState = fs.existsSync(opts.labelsLog)
    ? JSON.parse(fs.readFileSync(opts.labelsLog, "utf8"))
    : { created: [], skipped: [], failed: [] };

  fs.mkdirSync(path.dirname(opts.log), { recursive: true });
  const logFd = fs.openSync(opts.log, "a");

  // ---------- 1. Create labels ----------
  console.log(
    `Creating ${data.labels.length} unique labels on ${opts.repo}…`,
  );
  for (const label of data.labels) {
    if (labelsState.created.includes(label)) continue;
    const args = [
      "label",
      "create",
      label,
      "--color",
      colorFor(label),
      "--description",
      describeFor(label),
      "--repo",
      opts.repo,
      // NOTE: deliberately without --force so existing labels with maintainer-set
      // colors/descriptions are NOT clobbered. Anything already on the repo is
      // treated as success via the 409-already-exists branch below.
    ];
    const r = await sh("gh", args);
    if (r.code === 0) {
      console.log(`  + ${label}`);
      labelsState.created.push(label);
    } else if (/already exists/i.test(r.stderr) || r.stderr.includes("409")) {
      console.log(`  = ${label} (exists)`);
      labelsState.skipped.push(label);
    } else {
      console.error(`  ! ${label} failed: ${r.stderr.trim()}`);
      labelsState.failed.push({ label, stderr: r.stderr });
    }
  }
  fs.writeFileSync(opts.labelsLog, JSON.stringify(labelsState, null, 2));

  // ---------- 2. Create issues ----------
  let made = 0;
  let skipped = 0;
  let failed = 0;
  const bodyFiles = [];
  for (const issue of issues) {
    if (alreadyCreated.has(issue.number)) {
      skipped++;
      continue;
    }
    const bodyFile = `/tmp/import/body-${issue.number}.md`;
    fs.writeFileSync(bodyFile, issue.body);
    bodyFiles.push(bodyFile);

    const args = [
      "issue",
      "create",
      "--title",
      issue.title,
      "--body-file",
      bodyFile,
      "--repo",
      opts.repo,
    ];
    for (const l of issue.labels) args.push("--label", l);

    let r;
    let attempt = 0;
    for (;;) {
      r = await sh("gh", args);
      if (r.code === 0) break;

      const m429 = r.stderr.match(/try again in (\d+)s/i);
      if (m429 && attempt < 5) {
        const wait = parseInt(m429[1], 10) + 1;
        console.warn(
          `  ! rate limited; sleeping ${wait}s (#${issue.number})…`,
        );
        await new Promise((res) => setTimeout(res, wait * 1000));
        attempt++;
        continue;
      }
      break;
    }

    if (r.code === 0) {
      const url = r.stdout.trim();
      const numMatch = url.match(/\/issues\/(\d+)/);
      const newNumber = numMatch ? parseInt(numMatch[1], 10) : null;
      made++;
      alreadyCreated.add(issue.number);
      const record = {
        sourceNumber: issue.number,
        number: newNumber,
        url,
        title: issue.title,
        labels: issue.labels,
        at: new Date().toISOString(),
      };
      fs.writeSync(logFd, JSON.stringify(record) + "\n");
      console.log(`  ✓ #${issue.number} → ${url}`);
    } else {
      failed++;
      console.error(`  ✗ #${issue.number} failed: ${r.stderr.trim()}`);
      fs.writeSync(
        logFd,
        JSON.stringify({
          sourceNumber: issue.number,
          error: r.stderr.trim(),
          at: new Date().toISOString(),
        }) + "\n",
      );
    }
  }
  fs.closeSync(logFd);

  // Cleanup body temp files.
  for (const bf of bodyFiles) {
    try {
      fs.unlinkSync(bf);
    } catch {
      /* ignore */
    }
  }

  const total = issues.length;
  console.log(
    `\nDone. created=${made} skipped(existing)=${skipped} failed=${failed} of ${total}.`,
  );
  console.log(`Log: ${opts.log}`);
  if (failed > 0) {
    console.error(`${failed} issues failed — re-run to retry (skips successful ones).`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.stack || err.message || err}`);
  process.exit(1);
});
