/**
 * pkgsize — query npm registry for package metadata without installing.
 */

export interface PackageStats {
  name: string;
  version: string;
  unpackedSize: number;    // bytes
  dependencyCount: number;
  maxDepth: number;
  downloadTime10Mbps: number; // ms estimate
  license: string;
  deprecated: boolean;
}

export interface FetchOptions {
  /** npm registry base URL (default: https://registry.npmjs.org) */
  registry?: string;
  /** timeout in ms (default: 5000) */
  timeout?: number;
}

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

function parsePackageArg(input: string): { name: string; version?: string } {
  // handle @scope/pkg@version, pkg@version, @scope/pkg
  const lastAt = input.lastIndexOf("@");
  if (lastAt === 0) {
    // @scope/pkg — no version
    return { name: input };
  }
  if (lastAt > 0) {
    return {
      name: input.slice(0, lastAt),
      version: input.slice(lastAt + 1),
    };
  }
  return { name: input };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "kB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTime(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function fetchJSON(url: string, timeout: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Count total dependencies and max depth from a deps object.
 */
export function countDeps(deps: Record<string, string> | undefined): { count: number; maxDepth: number } {
  if (!deps || Object.keys(deps).length === 0) return { count: 0, maxDepth: 0 };
  return { count: Object.keys(deps).length, maxDepth: 1 };
}

/**
 * Fetch package stats from the npm registry.
 */
export async function fetchPackageStats(
  input: string,
  options: FetchOptions = {}
): Promise<PackageStats> {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const timeout = options.timeout ?? 5000;
  const { name, version } = parsePackageArg(input);

  const encodedName = name.startsWith("@")
    ? `@${encodeURIComponent(name.slice(1))}`
    : encodeURIComponent(name);

  const data = await fetchJSON(`${registry}/${encodedName}`, timeout);

  const distTags = data["dist-tags"] ?? {};
  const targetVersion = version ?? distTags.latest;
  if (!targetVersion || !data.versions?.[targetVersion]) {
    throw new Error(`Version "${targetVersion}" not found for ${name}`);
  }

  const v = data.versions[targetVersion];
  const deps = countDeps(v.dependencies);
  const unpackedSize = v.dist?.unpackedSize ?? 0;

  // estimate download time at 10 Mbps (1.25 MB/s)
  const downloadTimeMs = unpackedSize > 0 ? (unpackedSize / (1.25 * 1024 * 1024)) * 1000 : 0;

  return {
    name,
    version: targetVersion,
    unpackedSize,
    dependencyCount: deps.count,
    maxDepth: deps.maxDepth,
    downloadTime10Mbps: downloadTimeMs,
    license: v.license ?? "unknown",
    deprecated: !!v.deprecated,
  };
}

/**
 * Format stats for terminal output.
 */
export function formatStatsTable(stats: PackageStats[]): string {
  const lines: string[] = [];

  // find max name length for alignment
  const maxName = Math.max(...stats.map((s) => s.name.length), 4);

  for (const s of stats) {
    const deprecated = s.deprecated ? " ⚠ deprecated" : "";
    const line = `${s.name.padEnd(maxName + 2)} ${formatBytes(s.unpackedSize).padStart(10)}  ${String(s.dependencyCount).padStart(3)} deps  ~${formatTime(s.downloadTime10Mbps)}${deprecated}`;
    lines.push(line);
  }

  return lines.join("\n");
}

export { formatBytes, formatTime, parsePackageArg };
