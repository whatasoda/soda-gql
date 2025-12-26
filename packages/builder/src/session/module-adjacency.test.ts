import { describe, expect, test } from "bun:test";
import { type CanonicalId, createCanonicalId } from "@soda-gql/common";
import type { ModuleAnalysis, ModuleDefinition } from "../ast";
import type { DiscoverySnapshot } from "../discovery";
import { collectAffectedFiles, extractModuleAdjacency } from "./module-adjacency";

// Helper: create mock DiscoverySnapshot
const createMockSnapshot = (
  filePath: string,
  dependencies: Array<{
    canonicalId: CanonicalId;
    resolvedPath: string | null;
  }> = [],
  imports: Array<{
    source: string;
    imported: string;
    local: string;
    kind: string;
    isTypeOnly: boolean;
  }> = [],
): DiscoverySnapshot => {
  const canonicalId = createCanonicalId(filePath, "default");
  const definition: ModuleDefinition = {
    canonicalId,
    astPath: "default",
    isTopLevel: true,
    isExported: true,
    expression: "gql.default({})",
  };

  const analysis: ModuleAnalysis = {
    filePath,
    signature: `sig-${filePath}`,
    definitions: [definition],
    imports: imports.map((imp) => ({
      source: imp.source,
      imported: imp.imported,
      local: imp.local,
      kind: imp.kind as "named" | "namespace" | "default",
      isTypeOnly: imp.isTypeOnly,
    })),
    exports: [],
  };

  return {
    filePath,
    normalizedFilePath: filePath,
    signature: `sig-${filePath}`,
    fingerprint: {
      hash: `hash-${filePath}`,
      sizeBytes: 100,
      mtimeMs: Date.now(),
    },
    analyzer: "ts",
    createdAtMs: Date.now(),
    analysis,
    dependencies: dependencies.map((d) => ({
      specifier: d.resolvedPath || "",
      resolvedPath: d.resolvedPath,
      isExternal: false,
    })),
  };
};

describe("Module Adjacency", () => {
  describe("extractModuleAdjacency", () => {
    test("should build adjacency from snapshots - simple chain", () => {
      // A depends on B, B depends on C
      const bCanonicalId = createCanonicalId("/src/b.ts", "default");
      const cCanonicalId = createCanonicalId("/src/c.ts", "default");

      const snapshots = new Map<string, DiscoverySnapshot>([
        ["/src/a.ts", createMockSnapshot("/src/a.ts", [{ canonicalId: bCanonicalId, resolvedPath: "/src/b.ts" }])],
        ["/src/b.ts", createMockSnapshot("/src/b.ts", [{ canonicalId: cCanonicalId, resolvedPath: "/src/c.ts" }])],
        ["/src/c.ts", createMockSnapshot("/src/c.ts", [])],
      ]);

      const adjacency = extractModuleAdjacency({ snapshots });

      // B is imported by A
      expect(adjacency.get("/src/b.ts")?.has("/src/a.ts")).toBe(true);
      // C is imported by B
      expect(adjacency.get("/src/c.ts")?.has("/src/b.ts")).toBe(true);
      // A has no importers
      expect(adjacency.get("/src/a.ts")?.size).toBe(0);
    });

    test("should include isolated modules with empty sets", () => {
      const snapshots = new Map<string, DiscoverySnapshot>([["/src/isolated.ts", createMockSnapshot("/src/isolated.ts", [])]]);

      const adjacency = extractModuleAdjacency({ snapshots });

      expect(adjacency.has("/src/isolated.ts")).toBe(true);
      expect(adjacency.get("/src/isolated.ts")?.size).toBe(0);
    });

    test("should handle runtime imports for modules with no dependencies", () => {
      const snapshots = new Map<string, DiscoverySnapshot>([
        [
          "/src/a.ts",
          createMockSnapshot(
            "/src/a.ts",
            [],
            [
              {
                source: "./b",
                imported: "*",
                local: "b",
                kind: "namespace",
                isTypeOnly: false,
              },
            ],
          ),
        ],
        ["/src/b.ts", createMockSnapshot("/src/b.ts", [])],
      ]);

      const adjacency = extractModuleAdjacency({ snapshots });

      // Note: resolveModuleSpecifierRuntime resolves "./b" from "/src/a.ts" to "/src/b.ts"
      expect(adjacency.has("/src/b.ts")).toBe(true);
    });

    test("should skip self-imports", () => {
      const aBarId = createCanonicalId("/src/a.ts", "bar");
      const snapshots = new Map<string, DiscoverySnapshot>([
        ["/src/a.ts", createMockSnapshot("/src/a.ts", [{ canonicalId: aBarId, resolvedPath: "/src/a.ts" }])],
      ]);

      const adjacency = extractModuleAdjacency({ snapshots });

      // Self-import should not create adjacency edge
      expect(adjacency.get("/src/a.ts")?.size).toBe(0);
    });
  });

  describe("collectAffectedModules", () => {
    test("should collect transitive dependents", () => {
      const adjacency = new Map<string, Set<string>>([
        ["/src/a.ts", new Set(["/src/b.ts"])],
        ["/src/b.ts", new Set(["/src/c.ts"])],
      ]);

      const changed = new Set(["/src/a.ts"]);
      const affected = collectAffectedFiles({
        changedFiles: changed,
        removedFiles: new Set(),
        previousModuleAdjacency: adjacency,
      });

      expect(affected.has("/src/a.ts")).toBe(true);
      expect(affected.has("/src/b.ts")).toBe(true);
      expect(affected.has("/src/c.ts")).toBe(true);
    });

    test("should handle isolated changes", () => {
      const adjacency = new Map<string, Set<string>>([["/src/a.ts", new Set()]]);

      const changed = new Set(["/src/a.ts"]);
      const affected = collectAffectedFiles({
        changedFiles: changed,
        removedFiles: new Set(),
        previousModuleAdjacency: adjacency,
      });

      expect(affected.size).toBe(1);
      expect(affected.has("/src/a.ts")).toBe(true);
    });

    test("should handle multiple changed files", () => {
      const adjacency = new Map<string, Set<string>>([
        ["/src/a.ts", new Set(["/src/b.ts"])],
        ["/src/c.ts", new Set(["/src/d.ts"])],
      ]);

      const changed = new Set(["/src/a.ts", "/src/c.ts"]);
      const affected = collectAffectedFiles({
        changedFiles: changed,
        removedFiles: new Set(),
        previousModuleAdjacency: adjacency,
      });

      expect(affected.size).toBe(4);
      expect(affected.has("/src/a.ts")).toBe(true);
      expect(affected.has("/src/b.ts")).toBe(true);
      expect(affected.has("/src/c.ts")).toBe(true);
      expect(affected.has("/src/d.ts")).toBe(true);
    });
  });
});
