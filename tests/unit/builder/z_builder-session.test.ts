import { describe, expect, test } from "bun:test";
import type { ModuleAnalysis, ModuleDefinition } from "@soda-gql/builder/ast";
import type { DiscoverySnapshot } from "@soda-gql/builder/discovery/types";
import { __internal } from "@soda-gql/builder/internal/session/builder-session";
import type { CanonicalId } from "@soda-gql/common";
import { createCanonicalId } from "@soda-gql/common";

// Helper: create mock DiscoverySnapshot
const createMockSnapshot = (
  filePath: string,
  dependencies: Array<{ canonicalId: CanonicalId; resolvedPath: string | null }> = [],
  imports: Array<{ source: string; imported: string; local: string; kind: string; isTypeOnly: boolean }> = [],
): DiscoverySnapshot => {
  const canonicalId = createCanonicalId(filePath, "default");
  const definition: ModuleDefinition = {
    canonicalId,
    astPath: "default",
    isTopLevel: true,
    isExported: true,
    expression: "gql.default({})",
    loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    dependencies: dependencies.map((d) => ({ canonicalId: d.canonicalId, source: d.resolvedPath || "" })),
  };

  const analysis: ModuleAnalysis = {
    filePath,
    definitions: [definition],
    imports,
  };

  return {
    filePath,
    normalizedFilePath: filePath,
    analyzer: "ts",
    signature: `sig-${filePath}`,
    fingerprint: { hash: `hash-${filePath}`, sizeBytes: 100, mtimeMs: Date.now() },
    metadata: { analyzerVersion: "ts", schemaHash: "test" },
    createdAtMs: Date.now(),
    analysis,
    definitions: [definition],
    dependencies,
    diagnostics: [],
    exports: [],
    imports,
  };
};

describe("BuilderSession - Internal Helpers", () => {
  describe("extractModuleAdjacency", () => {
    test("should build adjacency from snapshots - simple chain", async () => {
      // A depends on B, B depends on C
      const bCanonicalId = createCanonicalId("/src/b.ts", "default");
      const cCanonicalId = createCanonicalId("/src/c.ts", "default");

      const snapshots = new Map<string, DiscoverySnapshot>([
        [
          "/src/a.ts",
          createMockSnapshot("/src/a.ts", [{ canonicalId: bCanonicalId, resolvedPath: "/src/b.ts" }]),
        ],
        [
          "/src/b.ts",
          createMockSnapshot("/src/b.ts", [{ canonicalId: cCanonicalId, resolvedPath: "/src/c.ts" }]),
        ],
        ["/src/c.ts", createMockSnapshot("/src/c.ts", [])],
      ]);

      const adjacency = await __internal.extractModuleAdjacency(snapshots);

      // B is imported by A
      expect(adjacency.get("/src/b.ts")?.has("/src/a.ts")).toBe(true);
      // C is imported by B
      expect(adjacency.get("/src/c.ts")?.has("/src/b.ts")).toBe(true);
      // A has no importers
      expect(adjacency.get("/src/a.ts")?.size).toBe(0);
    });

    test("should include isolated modules with empty sets", async () => {
      const snapshots = new Map<string, DiscoverySnapshot>([["/src/isolated.ts", createMockSnapshot("/src/isolated.ts", [])]]);

      const adjacency = await __internal.extractModuleAdjacency(snapshots);

      expect(adjacency.has("/src/isolated.ts")).toBe(true);
      expect(adjacency.get("/src/isolated.ts")?.size).toBe(0);
    });

    test("should handle runtime imports for modules with no dependencies", async () => {
      const snapshots = new Map<string, DiscoverySnapshot>([
        [
          "/src/a.ts",
          createMockSnapshot("/src/a.ts", [], [{ source: "./b", imported: "*", local: "b", kind: "namespace", isTypeOnly: false }]),
        ],
        ["/src/b.ts", createMockSnapshot("/src/b.ts", [])],
      ]);

      const adjacency = await __internal.extractModuleAdjacency(snapshots);

      // Note: resolveModuleSpecifierRuntime resolves "./b" from "/src/a.ts" to "/src/b.ts"
      expect(adjacency.has("/src/b.ts")).toBe(true);
    });

    test("should skip self-imports", async () => {
      const aBarId = createCanonicalId("/src/a.ts", "bar");
      const snapshots = new Map<string, DiscoverySnapshot>([
        ["/src/a.ts", createMockSnapshot("/src/a.ts", [{ canonicalId: aBarId, resolvedPath: "/src/a.ts" }])],
      ]);

      const adjacency = await __internal.extractModuleAdjacency(snapshots);

      // Self-import should not create adjacency edge
      expect(adjacency.get("/src/a.ts")?.size).toBe(0);
    });
  });

  describe("resolveModuleSpecifierRuntime", () => {
    test("should resolve from in-memory snapshots first", async () => {
      const snapshots = new Map([["/src/foo.ts", createMockSnapshot("/src/foo.ts", [])]]);
      const resolved = await __internal.resolveModuleSpecifierRuntime("./foo", "/src/bar.ts", snapshots);
      expect(resolved).toBe("/src/foo.ts");
    });

    test("should return null for bare specifiers", async () => {
      const snapshots = new Map();
      const resolved = await __internal.resolveModuleSpecifierRuntime("react", "/src/bar.ts", snapshots);
      expect(resolved).toBeNull();
    });

    test("should return null for scoped package imports", async () => {
      const snapshots = new Map();
      const resolved = await __internal.resolveModuleSpecifierRuntime("@scope/package", "/src/bar.ts", snapshots);
      expect(resolved).toBeNull();
    });
  });

  describe("metadataMatches", () => {
    test("should return true when metadata matches", () => {
      const changeSetMeta = { schemaHash: "abc", analyzerVersion: "ts" };
      const sessionMeta = { schemaHash: "abc", analyzerVersion: "ts" };
      expect(__internal.metadataMatches(changeSetMeta, sessionMeta)).toBe(true);
    });

    test("should return false when schema hash differs", () => {
      const changeSetMeta = { schemaHash: "xyz", analyzerVersion: "ts" };
      const sessionMeta = { schemaHash: "abc", analyzerVersion: "ts" };
      expect(__internal.metadataMatches(changeSetMeta, sessionMeta)).toBe(false);
    });

    test("should return false when analyzer version differs", () => {
      const changeSetMeta = { schemaHash: "abc", analyzerVersion: "rust" };
      const sessionMeta = { schemaHash: "abc", analyzerVersion: "ts" };
      expect(__internal.metadataMatches(changeSetMeta, sessionMeta)).toBe(false);
    });
  });

  describe("collectAffectedModules", () => {
    test("should collect transitive dependents", () => {
      const adjacency = new Map<string, Set<string>>([
        ["/src/a.ts", new Set(["/src/b.ts"])],
        ["/src/b.ts", new Set(["/src/c.ts"])],
      ]);

      const changed = new Set(["/src/a.ts"]);
      const affected = __internal.collectAffectedModules(changed, adjacency);

      expect(affected.has("/src/a.ts")).toBe(true);
      expect(affected.has("/src/b.ts")).toBe(true);
      expect(affected.has("/src/c.ts")).toBe(true);
    });

    test("should handle isolated changes", () => {
      const adjacency = new Map<string, Set<string>>([["/src/a.ts", new Set()]]);

      const changed = new Set(["/src/a.ts"]);
      const affected = __internal.collectAffectedModules(changed, adjacency);

      expect(affected.size).toBe(1);
      expect(affected.has("/src/a.ts")).toBe(true);
    });

    test("should handle multiple changed files", () => {
      const adjacency = new Map<string, Set<string>>([
        ["/src/a.ts", new Set(["/src/b.ts"])],
        ["/src/c.ts", new Set(["/src/d.ts"])],
      ]);

      const changed = new Set(["/src/a.ts", "/src/c.ts"]);
      const affected = __internal.collectAffectedModules(changed, adjacency);

      expect(affected.size).toBe(4);
      expect(affected.has("/src/a.ts")).toBe(true);
      expect(affected.has("/src/b.ts")).toBe(true);
      expect(affected.has("/src/c.ts")).toBe(true);
      expect(affected.has("/src/d.ts")).toBe(true);
    });
  });
});
