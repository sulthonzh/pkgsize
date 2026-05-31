/**
 * pkgsize — Analyze what actually ships in your npm package.
 *
 * Shows per-file sizes, tree composition, and trim suggestions
 * so you can cut the fat before publishing.
 */
export interface FileEntry {
    path: string;
    size: number;
    /** Category: source, test, doc, config, asset, misc */
    category: string;
}
export interface PkgSizeResult {
    name: string;
    version: string;
    totalFiles: number;
    totalSize: number;
    files: FileEntry[];
    categories: Record<string, {
        count: number;
        size: number;
    }>;
    /** Only present when `compareWithPublished` is true. */
    publishedSize?: number;
}
export interface Suggestion {
    file: string;
    reason: string;
    potentialSaving: number;
    severity: "info" | "warn" | "critical";
}
export declare function formatBytes(bytes: number): string;
export declare function formatTable(result: PkgSizeResult): string;
export declare function formatJSON(result: PkgSizeResult): string;
export declare function formatMarkdown(result: PkgSizeResult): string;
export declare function analyze(pkgDir?: string): PkgSizeResult;
