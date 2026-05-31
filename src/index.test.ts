import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { analyze, formatBytes, formatTable, formatJSON, formatMarkdown, Suggestion, FileEntry, PkgSizeResult } from "./index";

// Helper to create a temp project
function createTempProject(structure: Record<string, string | Buffer>, pkgOverrides: Record<string, any> = {}): string {
  const dir = fs.mkdtempSync("/tmp/pkgsize-test-");

  const defaultPkg = {
    name: "test-pkg",
    version: "1.0.0",
    ...pkgOverrides,
  };

  for (const [filePath, content] of Object.entries(structure)) {
    const full = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === "string" ? content : Buffer.from(content));
  }

  if (!structure["package.json"]) {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(defaultPkg, null, 2));
  }

  return dir;
}

describe("analyze", () => {
  it("should throw if no package.json", () => {
    const dir = fs.mkdtempSync("/tmp/pkgsize-test-");
    expect(() => analyze(dir)).toThrow("No package.json found");
    fs.rmSync(dir, { recursive: true });
  });

  it("should return basic result for minimal package", () => {
    const dir = createTempProject({
      "package.json": JSON.stringify({ name: "mini", version: "2.0.0" }),
    });

    const result = analyze(dir);
    expect(result.name).toBe("mini");
    expect(result.version).toBe("2.0.0");
    expect(result.totalFiles).toBe(1); // package.json itself
    expect(result.files.length).toBe(1);
    expect(result.totalSize).toBeGreaterThan(0);

    fs.rmSync(dir, { recursive: true });
  });

  it("should respect files whitelist", () => {
    const dir = createTempProject(
      {
        "dist/index.js": "const a = 1;",
        "dist/index.d.ts": "export declare const a: number;",
        "test/index.test.js": "test('x', () => {});",
        "README.md": "# hello",
        ".eslintrc.json": "{}",
      },
      { files: ["dist"] }
    );

    const result = analyze(dir);
    expect(result.files.length).toBe(2);
    expect(result.files.every((f) => f.path.startsWith("dist"))).toBe(true);
    expect(result.files.find((f) => f.path.includes("test"))).toBeUndefined();

    fs.rmSync(dir, { recursive: true });
  });

  it("should categorize files correctly", () => {
    const dir = createTempProject({
      "dist/index.js": "export const x = 1;",
      "dist/index.js.map": '{"version":3}',
      "src/index.ts": "export const x = 1;",
      "test/foo.test.ts": "test('foo', () => {});",
      "README.md": "# pkg",
      ".eslintrc.json": "{}",
      "assets/logo.png": Buffer.alloc(1024),
    });

    const result = analyze(dir);
    const cats = result.files;

    expect(cats.find((f) => f.path.endsWith(".test.ts"))?.category).toBe("test");
    expect(cats.find((f) => f.path.endsWith(".map"))?.category).toBe("sourcemap");
    expect(cats.find((f) => f.path.endsWith(".md"))?.category).toBe("doc");
    expect(cats.find((f) => f.path.endsWith(".ts") && f.path.includes("src"))?.category).toBe("source");
    expect(cats.find((f) => f.path.endsWith(".js") && !f.path.includes("map"))?.category).toBe("source");
    expect(cats.find((f) => f.path.endsWith(".png"))?.category).toBe("asset");
    expect(cats.find((f) => f.path.includes("eslintrc"))?.category).toBe("config");

    fs.rmSync(dir, { recursive: true });
  });

  it("should calculate category summaries", () => {
    const dir = createTempProject({
      "dist/a.js": "a".repeat(1000),
      "dist/b.js": "b".repeat(2000),
      "README.md": "# readme content here",
    });

    const result = analyze(dir);
    expect(result.categories.source).toBeDefined();
    expect(result.categories.source!.count).toBe(2);
    expect(result.categories.source!.size).toBe(3000);
    expect(result.categories.doc).toBeDefined();

    fs.rmSync(dir, { recursive: true });
  });

  it("should exclude node_modules", () => {
    const dir = createTempProject({
      "dist/index.js": "export const x = 1;",
      "node_modules/lodash/index.js": "module.exports = {};".repeat(100),
    });

    const result = analyze(dir);
    expect(result.files.find((f) => f.path.includes("node_modules"))).toBeUndefined();

    fs.rmSync(dir, { recursive: true });
  });
});

describe("formatBytes", () => {
  it("should format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("formatTable", () => {
  it("should produce readable table output", () => {
    const result: PkgSizeResult = {
      name: "test-pkg",
      version: "1.0.0",
      totalFiles: 2,
      totalSize: 200,
      files: [
        { path: "dist/a.js", size: 150, category: "source" },
        { path: "README.md", size: 50, category: "doc" },
      ],
      categories: {
        source: { count: 1, size: 150 },
        doc: { count: 1, size: 50 },
      },
    };

    const table = formatTable(result);
    expect(table).toContain("test-pkg@1.0.0");
    expect(table).toContain("2 files");
    expect(table).toContain("dist/a.js");
    expect(table).toContain("README.md");
    expect(table).toContain("source");
    expect(table).toContain("doc");
  });
});

describe("formatJSON", () => {
  it("should produce valid JSON with suggestions", () => {
    const result: PkgSizeResult = {
      name: "my-pkg",
      version: "3.0.0",
      totalFiles: 1,
      totalSize: 100,
      files: [{ path: "dist/index.js.map", size: 100, category: "sourcemap" }],
      categories: { sourcemap: { count: 1, size: 100 } },
    };

    const json = formatJSON(result);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("my-pkg");
    expect(parsed.suggestions.length).toBeGreaterThan(0);
    expect(parsed.suggestions[0].reason).toContain("Source maps");
  });
});

describe("formatMarkdown", () => {
  it("should produce markdown with tables", () => {
    const result: PkgSizeResult = {
      name: "md-pkg",
      version: "1.0.0",
      totalFiles: 1,
      totalSize: 500,
      files: [{ path: "dist/index.js", size: 500, category: "source" }],
      categories: { source: { count: 1, size: 500 } },
    };

    const md = formatMarkdown(result);
    expect(md).toContain("# md-pkg@1.0.0");
    expect(md).toContain("| Category |");
    expect(md).toContain("| Size | % |");
    expect(md).toContain("`dist/index.js`");
  });
});

describe("suggestions", () => {
  it("should flag source maps", () => {
    const dir = createTempProject({
      "dist/index.js": "x",
      "dist/index.js.map": '{"version":3}'.repeat(20),
    });

    const result = analyze(dir);
    const json = JSON.parse(formatJSON(result));
    const mapSuggestion = json.suggestions?.find((s: any) => s.file.endsWith(".map"));
    expect(mapSuggestion).toBeDefined();
    expect(mapSuggestion.severity).toBe("warn");

    fs.rmSync(dir, { recursive: true });
  });

  it("should flag test files", () => {
    const dir = createTempProject({
      "dist/index.js": "x",
      "test/index.test.js": "test('x', () => {});",
    });

    const result = analyze(dir);
    const json = JSON.parse(formatJSON(result));
    const testSuggestion = json.suggestions?.find((s: any) => s.file.includes("test"));
    expect(testSuggestion).toBeDefined();

    fs.rmSync(dir, { recursive: true });
  });

  it("should flag large files", () => {
    const dir = createTempProject({
      "dist/bundle.js": "x".repeat(200 * 1024), // 200KB
    });

    const result = analyze(dir);
    const json = JSON.parse(formatJSON(result));
    const largeSuggestion = json.suggestions?.find((s: any) => s.severity === "critical");
    expect(largeSuggestion).toBeDefined();
    expect(largeSuggestion.reason).toContain("Large file");

    fs.rmSync(dir, { recursive: true });
  });
});
