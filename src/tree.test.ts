import { describe, it, expect } from "vitest";
import { treeTotalSize, renderTree } from "./tree.js";
import type { PackageStats } from "./index.js";

describe("treeTotalSize", () => {
  it("returns 0 for empty node", () => {
    expect(treeTotalSize({ name: "x", version: "1.0.0", size: 0, children: [] })).toBe(0);
  });

  it("sums root size", () => {
    const node = { name: "a", version: "1.0.0", size: 100, children: [] };
    expect(treeTotalSize(node)).toBe(100);
  });

  it("sums tree with children", () => {
    const node = {
      name: "a", version: "1.0.0", size: 100,
      children: [
        { name: "b", version: "2.0.0", size: 200, children: [] },
        { name: "c", version: "3.0.0", size: 300, children: [] },
      ],
    };
    expect(treeTotalSize(node)).toBe(600);
  });

  it("deduplicates same name@version", () => {
    const node = {
      name: "a", version: "1.0.0", size: 100,
      children: [
        { name: "b", version: "2.0.0", size: 200, children: [] },
        { name: "b", version: "2.0.0", size: 200, children: [] },
      ],
    };
    expect(treeTotalSize(node)).toBe(300);
  });
});

describe("renderTree", () => {
  it("renders single node", () => {
    const node = { name: "pkg", version: "1.0.0", size: 1024, children: [] };
    const out = renderTree(node);
    expect(out).toContain("pkg@1.0.0");
    expect(out).toContain("1.0 kB");
    expect(out).toContain("Total unique size");
  });

  it("renders without size", () => {
    const node = { name: "pkg", version: "1.0.0", size: 0, children: [] };
    const out = renderTree(node, false);
    expect(out).toContain("pkg@1.0.0");
    expect(out).not.toContain("Total unique size");
  });

  it("renders children with tree connectors", () => {
    const node = {
      name: "root", version: "1.0.0", size: 500,
      children: [
        { name: "child-a", version: "2.0.0", size: 200, children: [] },
        { name: "child-b", version: "3.0.0", size: 300, children: [] },
      ],
    };
    const out = renderTree(node);
    expect(out).toContain("├── child-a@2.0.0");
    expect(out).toContain("└── child-b@3.0.0");
  });

  it("handles deeply nested tree", () => {
    const node = {
      name: "a", version: "1.0.0", size: 100,
      children: [{
        name: "b", version: "2.0.0", size: 200,
        children: [{
          name: "c", version: "3.0.0", size: 300, children: [],
        }],
      }],
    };
    const out = renderTree(node);
    expect(out).toContain("a@1.0.0");
    expect(out).toContain("b@2.0.0");
    expect(out).toContain("c@3.0.0");
  });
});
