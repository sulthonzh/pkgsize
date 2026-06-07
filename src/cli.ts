import { fetchPackageStats, formatStatsTable, type PackageStats } from "./index.js";
import { fetchTree, renderTree } from "./tree.js";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
pkgsize — see the real cost of npm packages before you install them

Usage:
  pkgsize <package...>          Check one or more packages
  pkgsize react@18              Specific version
  pkgsize --json lodash         JSON output
  pkgsize --raw express         Raw JSON from registry
  pkgsize --tree react          Show dependency tree
  pkgsize --tree --depth 3 react   Tree with custom depth (default: 2)

Options:
  --json           Machine-readable JSON output
  --raw            Raw registry data
  --tree           Show dependency tree
  --depth <n>      Tree depth (default: 2, max: 5)
  -h, --help       Show this help

Examples:
  pkgsize lodash axios express
  pkgsize @types/node
  pkgsize react@18 react-dom@18
  pkgsize --tree express
  pkgsize --tree --depth 3 next
`);
  process.exit(0);
}

const flags = {
  json: args.includes("--json"),
  raw: args.includes("--raw"),
  tree: args.includes("--tree"),
};

// parse --depth
let depth = 2;
const depthIdx = args.indexOf("--depth");
if (depthIdx !== -1 && args[depthIdx + 1]) {
  depth = Math.min(Math.max(parseInt(args[depthIdx + 1], 10) || 2, 1), 5);
}

const packages = args.filter((a) => !a.startsWith("-") && !a.match(/^\d+$/));

if (packages.length === 0) {
  console.error("No packages specified. Run `pkgsize --help` for usage.");
  process.exit(1);
}

async function main() {
  if (flags.tree) {
    // tree mode — one package at a time
    for (const pkg of packages) {
      try {
        const tree = await fetchTree(pkg, { maxDepth: depth });
        console.log(renderTree(tree));
        if (packages.indexOf(pkg) < packages.length - 1) console.log();
      } catch (err: any) {
        console.error(`Failed to fetch tree for ${pkg}: ${err.message}`);
      }
    }
    return;
  }

  const results: PackageStats[] = [];
  const errors: { pkg: string; error: string }[] = [];

  // fetch in parallel
  const promises = packages.map(async (pkg) => {
    try {
      const stats = await fetchPackageStats(pkg);
      results.push(stats);
    } catch (err: any) {
      errors.push({ pkg, error: err.message });
    }
  });

  await Promise.all(promises);

  if (flags.raw) {
    console.log(JSON.stringify(results, null, 2));
  } else if (flags.json) {
    const output = results.map((s) => ({
      name: s.name,
      version: s.version,
      size: s.unpackedSize,
      dependencies: s.dependencyCount,
      downloadTimeMs: Math.round(s.downloadTime10Mbps),
      license: s.license,
      deprecated: s.deprecated,
    }));
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatStatsTable(results));
  }

  if (errors.length > 0) {
    console.error(
      "\nFailed:\n" + errors.map((e) => `  ${e.pkg}: ${e.error}`).join("\n")
    );
    process.exit(1);
  }
}

main();
