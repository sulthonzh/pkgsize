/**
 * Dependency tree fetching and rendering for pkgsize.
 */

import { fetchPackageStats, type FetchOptions, type PackageStats } from "./index.js";

interface TreeNode {
  name: string;
  version: string;
  size: number;
  stats?: PackageStats;
  children: TreeNode[];
}

/**
 * Fetch the dependency tree recursively up to maxDepth levels.
 */
export async function fetchTree(
  input: string,
  options: FetchOptions & { maxDepth?: number } = {}
): Promise<TreeNode> {
  const maxDepth = options.maxDepth ?? 2;
  return fetchTreeNode(input, options, 0, maxDepth, new Set());
}

async function fetchTreeNode(
  input: string,
  options: FetchOptions,
  depth: number,
  maxDepth: number,
  visited: Set<string>
): Promise<TreeNode> {
  const stats = await fetchPackageStats(input, options);
  const key = `${stats.name}@${stats.version}`;

  const node: TreeNode = {
    name: stats.name,
    version: stats.version,
    size: stats.unpackedSize,
    stats,
    children: [],
  };

  if (depth >= maxDepth || visited.has(key)) {
    return node;
  }

  visited.add(key);

  // fetch direct deps from registry to get their names
  const registry = options.registry ?? "https://registry.npmjs.org";
  const timeout = options.timeout ?? 5000;
  const encodedName = stats.name.startsWith("@")
    ? `@${encodeURIComponent(stats.name.slice(1))}`
    : encodeURIComponent(stats.name);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`${registry}/${encodedName}`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    const v = data.versions?.[stats.version];
    const deps = v?.dependencies ?? {};

    const depNames = Object.keys(deps);
    // only fetch first-level children if we're within depth
    if (depth < maxDepth && depNames.length > 0) {
      // cap at 20 deps to avoid rate limits
      const toFetch = depNames.slice(0, 20);
      const children = await Promise.all(
        toFetch.map((depName) => {
          // pass just the name — the registry resolves to latest
          return fetchTreeNode(depName, { ...options, timeout: 3000 }, depth + 1, maxDepth, visited).catch(() => ({
            name: depName,
            version: deps[depName] ?? "?",
            size: 0,
            children: [],
          }));
        })
      );
      node.children = children;
      if (depNames.length > 20) {
        node.children.push({
          name: `... and ${depNames.length - 20} more`,
          version: "",
          size: 0,
          children: [],
        });
      }
    }
  } catch {
    // can't fetch deps — just return the node as-is
  }

  return node;
}

/**
 * Calculate total tree size (sum of all unique nodes).
 */
export function treeTotalSize(node: TreeNode): number {
  const visited = new Set<string>();
  let total = 0;
  function walk(n: TreeNode) {
    const key = `${n.name}@${n.version}`;
    if (!visited.has(key)) {
      visited.add(key);
      total += n.size;
    }
    n.children.forEach(walk);
  }
  walk(node);
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "kB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Render the dependency tree as a string.
 */
export function renderTree(node: TreeNode, showSize = true): string {
  const total = treeTotalSize(node);
  const lines: string[] = [];

  function walk(n: TreeNode, prefix: string, isLast: boolean) {
    const connector = isLast ? "└── " : "├── ";
    const size = showSize && n.size > 0 ? ` (${formatBytes(n.size)})` : "";
    const label = n.version ? `${n.name}@${n.version}` : n.name;
    lines.push(`${prefix}${connector}${label}${size}`);

    const childPrefix = prefix + (isLast ? "    " : "│   ");
    n.children.forEach((child, i) => {
      walk(child, childPrefix, i === n.children.length - 1);
    });
  }

  const rootSize = showSize ? ` (${formatBytes(node.size)})` : "";
  lines.push(`${node.name}@${node.version}${rootSize}`);
  node.children.forEach((child, i) => {
    walk(child, "", i === node.children.length - 1);
  });

  // add total
  if (showSize) {
    lines.push(``);
    lines.push(`Total unique size: ${formatBytes(total)} across ${countUnique(node)} packages`);
  }

  return lines.join("\n");
}

function countUnique(node: TreeNode): number {
  const visited = new Set<string>();
  function walk(n: TreeNode) {
    visited.add(`${n.name}@${n.version}`);
    n.children.forEach(walk);
  }
  walk(node);
  return visited.size;
}
