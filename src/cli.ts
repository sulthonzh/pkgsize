#!/usr/bin/env node
/**
 * pkgsize CLI — Analyze what actually ships in your npm package.
 */
import { analyze, formatTable, formatJSON, formatMarkdown } from "./index";

const args = process.argv.slice(2);

function usage() {
  console.log(`pkgsize — Analyze what actually ships in your npm package

Usage:
  pkgsize              Show package size breakdown
  pkgsize --json       JSON output
  pkgsize --markdown   Markdown output
  pkgsize --help       Show this help

Options:
  --json       Machine-readable JSON output
  --markdown   Markdown report
  -h, --help   Show help
`);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

try {
  const result = analyze();

  if (args.includes("--json")) {
    console.log(formatJSON(result));
  } else if (args.includes("--markdown")) {
    console.log(formatMarkdown(result));
  } else {
    console.log(formatTable(result));
  }
} catch (err: any) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
