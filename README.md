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

`npm install` hides the cost. You add a package, and suddenly you've pulled in 200 dependencies you didn't ask for. `pkgsize` shows you the real price upfront — unpacked size, dependency tree depth, and estimated download time.

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

# Compare with what's installed
pkgsize --compare lodash

# JSON output for scripts
pkgsize --json lodash

# Show dependency tree
pkgsize --tree express
```

## What it shows

| Column | Meaning |
|--------|---------|
| Size | Unpacked size on disk |
| Deps | Number of dependencies |
| DL | Estimated download time on 10Mbps |
| Depth | Max depth of dependency tree |

## How it works

Queries the npm registry API — no install needed. Fast, no side effects.

## License

MIT
