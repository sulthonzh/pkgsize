# pkgsize

Know what you're installing *before* you install it.

```bash
npx pkgsize lodash axios express
```

```
lodash    71.5 kB  0 deps  ~12ms
axios     41.2 kB  1 dep   ~7ms
express  205.8 kB  30 deps ~35ms
```

## Why?

`npm install` hides the cost. You add a package, and suddenly you've pulled in 200 dependencies you didn't ask for. `pkgsize` shows you the real price upfront — unpacked size, dependency count, and estimated download time.

## Install

```bash
npm install -g pkgsize
# or just run it
npx pkgsize <package-name...>
```

## Usage

```bash
# Check one or more packages
pkgsize lodash
pkgsize lodash axios express

# Specific version
pkgsize react@18

# JSON output for scripts
pkgsize --json lodash

# Show dependency tree
pkgsize --tree express
pkgsize --tree --depth 3 next

# Compare installed vs published
pkgsize --compare lodash axios
pkgsize --compare            # compares all deps from package.json
```

## Commands

| Flag | What it does |
|------|-------------|
| (default) | Show size, deps, download time |
| `--tree` | Show dependency tree |
| `--depth N` | Tree depth (1–5, default 2) |
| `--compare` | Compare local node_modules vs registry |
| `--json` | Machine-readable output |
| `--raw` | Raw registry JSON |

## What the output means

- **Size** — unpacked size on disk
- **Deps** — number of direct dependencies
- **DL time** — estimated download on 10Mbps

## --compare

Compares what you have installed locally against the latest published version:

```bash
pkgsize --compare lodash axios
```

```
lodash    local:     71.5 kB  remote:     71.5 kB  same        ✓
axios     local:    412.0 kB  remote:    380.2 kB  +31.8 kB    1.6.0 → 1.7.0
```

Run without package names to compare everything in your `package.json`.

## How it works

Queries the npm registry API directly — no install, no side effects. The `--compare` flag reads from your local `node_modules` to measure actual disk usage.

## License

MIT
