/**
 * pkgsize — Analyze what actually ships in your npm package.
 *
 * Shows per-file sizes, tree composition, and trim suggestions
 * so you can cut the fat before publishing.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEntry {
  path: string;
  size: number;
  /** Category: source, test, doc, config, asset, misc */
  category: string;
}

export interface PkgSizeResult {
  name: string;
  version: string;
  totalFiles: number;
  totalSize: number;
  files: FileEntry[];
  categories: Record<string, { count: number; size: number }>;
  /** Only present when `compareWithPublished` is true. */
  publishedSize?: number;
}

export interface Suggestion {
  file: string;
  reason: string;
  potentialSaving: number;
  severity: "info" | "warn" | "critical";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/\.test\.[jt]sx?$/, "test"],
  [/\.spec\.[jt]sx?$/, "test"],
  [/__tests__\//, "test"],
  [/test\//, "test"],
  [/tests?\//, "test"],
  [/\.md$/i, "doc"],
  [/license/i, "doc"],
  [/changelog/i, "doc"],
  [/\.tsx?\.map$/, "sourcemap"],
  [/\.jsx?\.map$/, "sourcemap"],
  [/\.css\.map$/, "sourcemap"],
  [/\.ts$/, "source"],
  [/\.tsx$/, "source"],
  [/\.js$/, "source"],
  [/\.jsx$/, "source"],
  [/\.mjs$/, "source"],
  [/\.cjs$/, "source"],
  [/\.json$/, "config"],
  [/\.ya?ml$/, "config"],
  [/\.toml$/, "config"],
  [/\.editorconfig$/, "config"],
  [/\.eslintrc/, "config"],
  [/\.prettierrc/, "config"],
  [/tsconfig/, "config"],
  [/\.png$|\.jpe?g$|\.gif$|\.svg$|\.ico$|\.webp$/i, "asset"],
  [/\.woff2?$|\.ttf$|\.eot$/i, "asset"],
  [/\.css$/i, "asset"],
];

function categorize(filePath: string): string {
  const norm = filePath.replace(/\\/g, "/");
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(norm)) return cat;
  }
  return "misc";
}

function walkDir(dir: string, base: string): FileEntry[] {
  const entries: FileEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    const rel = path.relative(base, full);
    if (item.isDirectory()) {
      entries.push(...walkDir(full, base));
    } else {
      const stat = fs.statSync(full);
      entries.push({
        path: rel,
        size: stat.size,
        category: categorize(rel),
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Resolve files that would be published
// ---------------------------------------------------------------------------

function resolvePublishFiles(pkgDir: string): FileEntry[] {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return [];

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const base = pkgDir;

  // If "files" whitelist exists, use it
  if (Array.isArray(pkg.files) && pkg.files.length > 0) {
    const entries: FileEntry[] = [];
    for (const pattern of pkg.files) {
      const full = path.join(base, pattern);
      if (fs.existsSync(full)) {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          entries.push(...walkDir(full, base));
        } else {
          entries.push({
            path: pattern,
            size: stat.size,
            category: categorize(pattern),
          });
        }
      }
    }
    return entries;
  }

  // Otherwise walk the whole dir (respecting .npmignore / node_modules)
  const all = walkDir(base, base);
  return all.filter((e) => {
    const p = e.path.replace(/\\/g, "/");
    if (p.startsWith("node_modules")) return false;
    if (p === "package.json") return true; // always included
    if (p.startsWith(".git")) return false;
    if (p === ".npmignore" || p === ".gitignore") return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function generateSuggestions(files: FileEntry[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  for (const f of files) {
    const pct = totalSize > 0 ? (f.size / totalSize) * 100 : 0;

    // Source maps
    if (f.category === "sourcemap") {
      suggestions.push({
        file: f.path,
        reason: "Source maps shouldn't ship to npm",
        potentialSaving: f.size,
        severity: "warn",
      });
    }

    // Tests
    if (f.category === "test") {
      suggestions.push({
        file: f.path,
        reason: "Test files are usually excluded from npm packages",
        potentialSaving: f.size,
        severity: "warn",
      });
    }

    // Large files (>100KB)
    if (f.size > 100 * 1024) {
      suggestions.push({
        file: f.path,
        reason: `Large file (${formatBytes(f.size)}) — ${pct.toFixed(1)}% of total`,
        potentialSaving: f.size,
        severity: "critical",
      });
    } else if (f.size > 50 * 1024 && pct > 10) {
      suggestions.push({
        file: f.path,
        reason: `Notably large (${formatBytes(f.size)}) — ${pct.toFixed(1)}% of total`,
        potentialSaving: f.size,
        severity: "warn",
      });
    }
  }

  // Config-heavy package
  const configFiles = files.filter((f) => f.category === "config");
  const configSize = configFiles.reduce((s, f) => s + f.size, 0);
  if (configSize > 5000 && totalSize > 0 && configSize / totalSize > 0.15) {
    suggestions.push({
      file: `(${configFiles.length} config files)`,
      reason: "Config files make up >15% of package — consider narrowing with `files` field",
      potentialSaving: configSize,
      severity: "info",
    });
  }

  // No "files" field suggestion
  return suggestions.sort((a, b) => {
    const sev = { critical: 0, warn: 1, info: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatTable(result: PkgSizeResult): string {
  const lines: string[] = [];
  const w = (s: string) => s;

  lines.push(w(`pkgsize — ${result.name}@${result.version}`));
  lines.push(w(`${result.totalFiles} files, ${formatBytes(result.totalSize)} total`));
  lines.push("");

  // Category summary
  lines.push(w("By category:"));
  const catEntries = Object.entries(result.categories).sort((a, b) => b[1].size - a[1].size);
  for (const [cat, info] of catEntries) {
    const pct = result.totalSize > 0 ? ((info.size / result.totalSize) * 100).toFixed(1) : "0.0";
    lines.push(w(`  ${cat.padEnd(10)} ${String(info.count).padStart(4)} files  ${formatBytes(info.size).padStart(8)}  ${pct}%`));
  }
  lines.push("");

  // Top files
  const top = [...result.files].sort((a, b) => b.size - a.size).slice(0, 20);
  lines.push(w("Top files:"));
  for (const f of top) {
    const pct = result.totalSize > 0 ? ((f.size / result.totalSize) * 100).toFixed(1) : "0.0";
    lines.push(w(`  ${formatBytes(f.size).padStart(8)}  ${pct.padStart(5)}%  ${f.path}`));
  }

  // Suggestions
  if (result.files.length > 0) {
    const suggestions = generateSuggestions(result.files);
    if (suggestions.length > 0) {
      lines.push("");
      lines.push(w("Suggestions:"));
      for (const s of suggestions.slice(0, 10)) {
        const icon = s.severity === "critical" ? "⚠" : s.severity === "warn" ? "!" : "i";
        lines.push(w(`  [${icon}] ${s.file}: ${s.reason}`));
      }
    }
  }

  return lines.join("\n");
}

export function formatJSON(result: PkgSizeResult): string {
  const suggestions = generateSuggestions(result.files);
  return JSON.stringify({ ...result, suggestions }, null, 2);
}

export function formatMarkdown(result: PkgSizeResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.name}@${result.version}`);
  lines.push("");
  lines.push(`**${result.totalFiles} files** — **${formatBytes(result.totalSize)}** total`);
  lines.push("");

  // Category table
  lines.push("## Categories");
  lines.push("");
  lines.push("| Category | Files | Size | % |");
  lines.push("|----------|------:|-----:|--:|");
  const catEntries = Object.entries(result.categories).sort((a, b) => b[1].size - a[1].size);
  for (const [cat, info] of catEntries) {
    const pct = result.totalSize > 0 ? ((info.size / result.totalSize) * 100).toFixed(1) : "0.0";
    lines.push(`| ${cat} | ${info.count} | ${formatBytes(info.size)} | ${pct}% |`);
  }
  lines.push("");

  // Top files
  lines.push("## Top 10 files");
  lines.push("");
  lines.push("| Size | % | File |");
  lines.push("|-----:|--:|------|");
  const top = [...result.files].sort((a, b) => b.size - a.size).slice(0, 10);
  for (const f of top) {
    const pct = result.totalSize > 0 ? ((f.size / result.totalSize) * 100).toFixed(1) : "0.0";
    lines.push(`| ${formatBytes(f.size)} | ${pct}% | \`${f.path}\` |`);
  }

  // Suggestions
  const suggestions = generateSuggestions(result.files);
  if (suggestions.length > 0) {
    lines.push("");
    lines.push("## Suggestions");
    lines.push("");
    for (const s of suggestions.slice(0, 10)) {
      const icon = s.severity === "critical" ? "🔴" : s.severity === "warn" ? "🟡" : "ℹ️";
      lines.push(`- ${icon} **${s.file}**: ${s.reason}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main analyze function
// ---------------------------------------------------------------------------

export function analyze(pkgDir?: string): PkgSizeResult {
  const dir = pkgDir || process.cwd();
  const pkgJsonPath = path.join(dir, "package.json");

  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`No package.json found in ${dir}`);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const files = resolvePublishFiles(dir);

  const categories: Record<string, { count: number; size: number }> = {};
  let totalSize = 0;
  for (const f of files) {
    totalSize += f.size;
    if (!categories[f.category]) {
      categories[f.category] = { count: 0, size: 0 };
    }
    categories[f.category].count++;
    categories[f.category].size += f.size;
  }

  return {
    name: pkg.name || "unknown",
    version: pkg.version || "0.0.0",
    totalFiles: files.length,
    totalSize,
    files,
    categories,
  };
}
