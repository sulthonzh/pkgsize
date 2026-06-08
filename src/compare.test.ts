import { describe, it, expect } from "vitest";
import { formatCompareTable, comparePackages } from "./compare.js";

describe("formatCompareTable", () => {
  it("shows message for empty results", () => {
    expect(formatCompareTable([])).toBe("No packages to compare.");
  });

  it("formats single result", () => {
    const results = [{
      name: "lodash",
      localVersion: "4.17.21",
      localSize: 1_000_000,
      remoteVersion: "4.17.21",
      remoteSize: 1_100_000,
      sizeDiff: 100_000,
      versionMatch: true,
    }];
    const out = formatCompareTable(results);
    expect(out).toContain("lodash");
    expect(out).toContain("✓");
    expect(out).toContain("+");
  });

  it("formats version mismatch", () => {
    const results = [{
      name: "express",
      localVersion: "4.18.0",
      localSize: 200_000,
      remoteVersion: "4.19.0",
      remoteSize: 210_000,
      sizeDiff: 10_000,
      versionMatch: false,
    }];
    const out = formatCompareTable(results);
    expect(out).toContain("4.18.0 → 4.19.0");
  });

  it("shows 'same' when no diff", () => {
    const results = [{
      name: "pkg",
      localVersion: "1.0.0",
      localSize: 100,
      remoteVersion: "1.0.0",
      remoteSize: 100,
      sizeDiff: 0,
      versionMatch: true,
    }];
    const out = formatCompareTable(results);
    expect(out).toContain("same");
  });
});

describe("comparePackages", () => {
  it("returns empty when no local packages found", async () => {
    const results = await comparePackages(["nonexistent-pkg-xyz-123"], "/tmp");
    expect(results).toEqual([]);
  });
});
