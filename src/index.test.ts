import { describe, it, expect } from "vitest";
import {
  parsePackageArg,
  formatBytes,
  formatTime,
  countDeps,
  fetchPackageStats,
} from "./index.js";

describe("parsePackageArg", () => {
  it("parses plain package", () => {
    expect(parsePackageArg("lodash")).toEqual({ name: "lodash" });
  });

  it("parses scoped package", () => {
    expect(parsePackageArg("@types/node")).toEqual({ name: "@types/node" });
  });

  it("parses package with version", () => {
    expect(parsePackageArg("react@18")).toEqual({ name: "react", version: "18" });
  });

  it("parses scoped package with version", () => {
    expect(parsePackageArg("@types/node@20")).toEqual({ name: "@types/node", version: "20" });
  });
});

describe("formatBytes", () => {
  it("formats 0", () => expect(formatBytes(0)).toBe("0 B"));
  it("formats bytes", () => expect(formatBytes(512)).toBe("512 B"));
  it("formats kB", () => expect(formatBytes(1024)).toBe("1.0 kB"));
  it("formats MB", () => expect(formatBytes(1048576)).toBe("1.0 MB"));
});

describe("formatTime", () => {
  it("formats <1ms", () => expect(formatTime(0.5)).toBe("<1ms"));
  it("formats ms", () => expect(formatTime(100)).toBe("100ms"));
  it("formats seconds", () => expect(formatTime(2500)).toBe("2.5s"));
});

describe("countDeps", () => {
  it("handles undefined", () => expect(countDeps(undefined)).toEqual({ count: 0, maxDepth: 0 }));
  it("handles empty", () => expect(countDeps({})).toEqual({ count: 0, maxDepth: 0 }));
  it("counts deps", () => expect(countDeps({ a: "1.0.0", b: "2.0.0" })).toEqual({ count: 2, maxDepth: 1 }));
});

describe("fetchPackageStats", () => {
  it("fetches real package", async () => {
    const stats = await fetchPackageStats("lodash");
    expect(stats.name).toBe("lodash");
    expect(stats.unpackedSize).toBeGreaterThan(0);
    expect(stats.license).toBeTruthy();
  }, 10000);

  it("throws for nonexistent package", async () => {
    await expect(fetchPackageStats("zzz-nonexistent-pkg-xyz-123")).rejects.toThrow();
  }, 10000);

  it("throws for nonexistent version", async () => {
    await expect(fetchPackageStats("lodash@999.999.999")).rejects.toThrow();
  }, 10000);
});
