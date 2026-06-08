import { describe, it, expect } from "vitest";
import {
  sortStats,
  formatStatsMarkdown,
  type PackageStats,
} from "./index.js";

function makeStats(overrides: Partial<PackageStats>[]): PackageStats[] {
  return overrides.map((o, i) => ({
    name: o.name ?? `pkg-${i}`,
    version: o.version ?? "1.0.0",
    unpackedSize: o.unpackedSize ?? 1000,
    dependencyCount: o.dependencyCount ?? 0,
    maxDepth: o.maxDepth ?? 0,
    downloadTime10Mbps: o.downloadTime10Mbps ?? 10,
    license: o.license ?? "MIT",
    deprecated: o.deprecated ?? false,
    ...o,
  }));
}

describe("sortStats", () => {
  it("sorts by size descending", () => {
    const stats = makeStats([
      { name: "a", unpackedSize: 500 },
      { name: "b", unpackedSize: 2000 },
      { name: "c", unpackedSize: 1000 },
    ]);
    const sorted = sortStats(stats, "size");
    expect(sorted.map((s) => s.name)).toEqual(["b", "c", "a"]);
  });

  it("sorts by size ascending", () => {
    const stats = makeStats([
      { name: "a", unpackedSize: 500 },
      { name: "b", unpackedSize: 2000 },
    ]);
    const sorted = sortStats(stats, "size", false);
    expect(sorted.map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("sorts by deps", () => {
    const stats = makeStats([
      { name: "a", dependencyCount: 5 },
      { name: "b", dependencyCount: 1 },
      { name: "c", dependencyCount: 10 },
    ]);
    const sorted = sortStats(stats, "deps");
    expect(sorted.map((s) => s.name)).toEqual(["c", "a", "b"]);
  });

  it("sorts by time", () => {
    const stats = makeStats([
      { name: "a", downloadTime10Mbps: 100 },
      { name: "b", downloadTime10Mbps: 500 },
    ]);
    const sorted = sortStats(stats, "time");
    expect(sorted.map((s) => s.name)).toEqual(["b", "a"]);
  });

  it("sorts by name ascending when descending=false", () => {
    const stats = makeStats([
      { name: "charlie" },
      { name: "alpha" },
      { name: "bravo" },
    ]);
    const sorted = sortStats(stats, "name", false);
    expect(sorted.map((s) => s.name)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("does not mutate original array", () => {
    const stats = makeStats([
      { name: "a", unpackedSize: 500 },
      { name: "b", unpackedSize: 2000 },
    ]);
    const original = stats.map((s) => s.name);
    sortStats(stats, "size");
    expect(stats.map((s) => s.name)).toEqual(original);
  });
});

describe("formatStatsMarkdown", () => {
  it("formats markdown table", () => {
    const stats = makeStats([
      { name: "lodash", unpackedSize: 73000, dependencyCount: 0, downloadTime10Mbps: 56 },
    ]);
    const md = formatStatsMarkdown(stats);
    expect(md).toContain("| Package | Size | Deps | Download |");
    expect(md).toContain("| lodash |");
  });

  it("shows deprecated warning", () => {
    const stats = makeStats([
      { name: "old-pkg", deprecated: true, unpackedSize: 1000, dependencyCount: 2, downloadTime10Mbps: 5 },
    ]);
    const md = formatStatsMarkdown(stats);
    expect(md).toContain("⚠️");
  });

  it("formats multiple packages", () => {
    const stats = makeStats([
      { name: "a", unpackedSize: 1000, dependencyCount: 1, downloadTime10Mbps: 10 },
      { name: "b", unpackedSize: 2000, dependencyCount: 2, downloadTime10Mbps: 20 },
    ]);
    const md = formatStatsMarkdown(stats);
    const rows = md.split("\n").filter((l) => l.startsWith("|") && !l.includes("---"));
    // header + 2 data rows = 3
    expect(rows.length).toBe(3);
  });
});
