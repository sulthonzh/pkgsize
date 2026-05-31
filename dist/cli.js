#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * pkgsize CLI — Analyze what actually ships in your npm package.
 */
const index_1 = require("./index");
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
    const result = (0, index_1.analyze)();
    if (args.includes("--json")) {
        console.log((0, index_1.formatJSON)(result));
    }
    else if (args.includes("--markdown")) {
        console.log((0, index_1.formatMarkdown)(result));
    }
    else {
        console.log((0, index_1.formatTable)(result));
    }
}
catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
}
