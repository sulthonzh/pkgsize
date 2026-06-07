/**
 * Compare published package stats against local node_modules.
 */

import { fetchPackageStats, formatBytes, type PackageStats } from "./index.js";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

interface LocalPkg {
  name: string;
  version: string;
  size: number;
}

interface CompareResult {
  name: string;
  localVersion: string;
  localSize: number;
  remoteVersion: string;
  remoteSize: number;
  sizeDiff: number;
  versionMatch: boolean;
}

function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else {
        total += statSync(full).size;
      }
    }
  } catch {
    // permission or race — skip
  }
  return total;
}

function readLocalPkg(pkgName: string, cwd: string): LocalPkg | null {
  const pkgPath = resolve(cwd, "node_modules", pkgName, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    const dir = resolve(cwd, "node_modules", pkgName);
    const size = dirSize(dir);
    return { name: pkgName, version: pkg.version || "?", size };
  } catch {
    return null;
  }
}

export async function comparePackages(
  pkgNames: string[],
  cwd: string = process.cwd()
): Promise<CompareResult[]> {
  const results: CompareResult[] = [];

  for (const name of pkgNames) {
    const local = readLocalPkg(name, cwd);
    if (!local) {
      console.error(`  ${name}: not found in node_modules — skipping`);
      continue;
    }

    try {
      const remote = await fetchPackageStats(name);
      results.push({
        name,
        localVersion: local.version,
        localSize: local.size,
        remoteVersion: remote.version,
        remoteSize: remote.unpackedSize,
        sizeDiff: remote.unpackedSize - local.size,
        versionMatch: local.version === remote.version,
      });
    } catch (err: any) {
      console.error(`  ${name}: failed to fetch remote — ${err.message}`);
    }
  }

  return results;
}

export function formatCompareTable(results: CompareResult[]): string {
  if (results.length === 0) return "No packages to compare.";

  const maxName = Math.max(...results.map((r) => r.name.length), 4);
  const lines: string[] = [];

  for (const r of results) {
    const version = r.versionMatch ? "✓" : `${r.localVersion} → ${r.remoteVersion}`;
    const diff = r.sizeDiff > 0 ? `+${formatBytes(r.sizeDiff)}` : r.sizeDiff < 0 ? formatBytes(r.sizeDiff) : "same";
    const local = formatBytes(r.localSize);
    const remote = formatBytes(r.remoteSize);
    const line = `${r.name.padEnd(maxName + 2)} local: ${local.padStart(10)}  remote: ${remote.padStart(10)}  ${diff.padStart(10)}  ${version}`;
    lines.push(line);
  }

  return lines.join("\n");
}
