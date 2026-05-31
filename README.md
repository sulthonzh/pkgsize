# pkgsize

Analyze what actually ships in your npm package.

Ever published a package and realized it's 10x bigger than expected? `pkgsize` shows you every file that would be included, categorized by type, with suggestions for trimming the fat.

## Why

npm packages often ship with way more than they need — source maps, test files, configs, docs, assets. Most devs don't check until something breaks. `pkgsize` gives you a breakdown *before* you publish.

## Install

```bash
npm install -g pkgsize
```

## Usage

```bash
# Run in any directory with a package.json
pkgsize

# JSON output (for CI, scripts)
pkgsize --json

# Markdown report
pkgsize --markdown
```

## What it does

1. **Resolves what would be published** — reads your `files` field in package.json (or walks the directory if there's no whitelist)
2. **Categorizes every file** — source, test, doc, config, asset, sourcemap, misc
3. **Shows size breakdown** — per-category and per-file with percentages
4. **Suggests improvements** — flags source maps, test files, large files, config-heavy packages

## Example output

```
pkgsize — my-lib@2.1.0
18 files, 45.2 KB total

By category:
  source       8 files     32.1 KB  71.0%
  sourcemap    8 files     10.5 KB  23.2%
  doc          1 files      2.4 KB   5.3%
  config       1 files      0.2 KB   0.4%

Top files:
   12.3 KB   27.2%  dist/index.js
    8.1 KB   17.9%  dist/index.js.map
    5.4 KB   11.9%  dist/utils.js
    3.2 KB    7.1%  dist/utils.js.map

Suggestions:
  [!] dist/index.js.map: Source maps shouldn't ship to npm
  [!] dist/utils.js.map: Source maps shouldn't ship to npm
```

## Programmatic API

```typescript
import { analyze, formatTable, formatJSON, formatMarkdown } from "pkgsize";

const result = analyze("./my-project");
console.log(formatTable(result));

// result has: name, version, totalFiles, totalSize, files[], categories{}
```

## Zero dependencies

No external deps. Just TypeScript and Node.js >= 18.

## License

MIT
