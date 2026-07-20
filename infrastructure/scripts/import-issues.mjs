#!/usr/bin/env node
/**
 * Parse `docs/ISSUES_100.md` into a structured JSON file with one entry per
 * issue. The structure is regular:
 *   - each issue starts with `### #N — <title>` on its own line
 *   - the body is everything between that header and the next issue header
 *     (or end-of-file)
 *   - the label list lives in `- **Labels.** \`<csv>\``
 *
 * Usage:
 *   node infrastructure/scripts/import-issues.mjs              # default paths
 *   node infrastructure/scripts/import-issues.mjs --in <path>  --out <path>
 *
 * Exit code 0 on success, non-zero on parse failure.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULTS = {
  in: "docs/ISSUES_100.md",
  out: "/tmp/import/issues.json",
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--in") out.in = argv[++i];
    else if (flag === "--out") out.out = argv[++i];
    else if (flag === "--help" || flag === "-h") {
      console.log("Usage: node import-issues.mjs [--in <md>] [--out <json>]");
      process.exit(0);
    }
  }
  return out;
}

/**
 * Extract the list of labels from an issue body. The label field is formatted
 * like:
 *   - **Labels.** `backend`, `security`, `auth`, `good first review`,
 *     `needs-spec`.
 *
 * Each tag is wrapped in its own pair of backticks and may span multiple
 * lines. The bullet terminates with a `.` (period).
 */
function extractLabels(body) {
  // Capture everything from after "- **Labels.**" until the bullet-ending
  // `.` followed by whitespace/newline/end-of-input. Non-greedy + lazy so
  // we stop at the first terminator.
  const headerRe = /-\s+\*\*Labels\.\*\*\s+([\s\S]*?)\.\s*(?=\n|$)/;
  const header = body.match(headerRe);
  if (!header) return [];
  // Pull every backticked token out of the captured segment. Labels may span
  // multiple lines (e.g. `good first\n  issue`) so collapse internal
  // whitespace so the token surfaces as a single string.
  return [...header[1].matchAll(/`([^`]+)`/g)]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

function parseIssues(md) {
  // Match `### #N — Title` lines. The title is anything after the em dash,
  // trimmed of trailing whitespace.
  const headerRe = /^### #(\d+) — (.+?)\s*$/gm;
  const matches = [...md.matchAll(headerRe)];

  if (matches.length === 0) {
    throw new Error("No issue headers matched the `### #N — Title` pattern.");
  }

  const issues = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
    const body = md.slice(start, end).trim();
    issues.push({
      number: Number(m[1]),
      title: m[2].trim(),
      body,
      labels: extractLabels(body),
    });
  }
  return issues;
}

/** Validate the parsed list looks like 100 sequential issues labelled #1..#100. */
function validate(issues) {
  if (issues.length !== 100) {
    throw new Error(
      `Expected 100 issues, got ${issues.length}. Numbers found: ${issues
        .slice(0, 5)
        .map((i) => i.number)
        .join(",")}…${issues[issues.length - 1]?.number}`,
    );
  }
  for (let i = 0; i < issues.length; i++) {
    if (issues[i].number !== i + 1) {
      throw new Error(
        `Issue at index ${i} has number ${issues[i].number}; expected ${i + 1}.`,
      );
    }
    if (!issues[i].title) {
      throw new Error(`Issue #${issues[i].number} has an empty title.`);
    }
    if (issues[i].labels.length === 0) {
      // Not fatal — but worth knowing.
      console.warn(
        `WARN: issue #${issues[i].number} has no Labels field parsed.`,
      );
    }
  }
}

function main() {
  const { in: inputPath, out: outputPath } = parseArgs(process.argv);
  const absIn = path.resolve(inputPath);
  const absOut = path.resolve(outputPath);
  if (!fs.existsSync(absIn)) {
    console.error(`Input file not found: ${absIn}`);
    process.exit(1);
  }
  const md = fs.readFileSync(absIn, "utf8");
  let issues;
  try {
    issues = parseIssues(md);
    validate(issues);
  } catch (err) {
    console.error(`Parse failed: ${err.message}`);
    process.exit(2);
  }

  const allLabels = new Set();
  for (const issue of issues) for (const l of issue.labels) allLabels.add(l);

  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(
    absOut,
    JSON.stringify(
      {
        source: absIn,
        generatedAt: new Date().toISOString(),
        count: issues.length,
        labels: [...allLabels].sort(),
        issues,
      },
      null,
      2,
    ),
  );
  console.log(
    `Parsed ${issues.length} issues with ${allLabels.size} unique labels → ${absOut}`,
  );
}

main();
