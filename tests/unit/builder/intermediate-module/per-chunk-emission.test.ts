import { describe, expect, test } from "bun:test";
import { createGraphIndex } from "@soda-gql/builder/dependency-graph/patcher";
import type { DependencyGraph, DependencyGraphNode } from "@soda-gql/builder/dependency-graph/types";
import { buildIntermediateModules } from "@soda-gql/builder/internal/intermediate-module/per-chunk-emission";
import { createCanonicalId } from "@soda-gql/common";

const createTestNode = (
  filePath: string,
  localPath: string,
  expression: string,
  dependencies: string[] = [],
): DependencyGraphNode => {
  const id = createCanonicalId(filePath, localPath);
  return {
    id,
    filePath,
    localPath,
    isExported: true,
    definition: {
      astPath: "",
      isTopLevel: true,
      isExported: true,
      expression,
      loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    },
    dependencies: dependencies.map((dep) => createCanonicalId(dep, "default")),
    moduleSummary: {
      filePath,
      runtimeImports: [],
      gqlExports: [],
    },
  };
};

describe("buildChunkModules", () => {
  test("should create single chunk for single file", () => {
    const graph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo", "gql.default({ name: 'Foo' })")],
    ]);

    const graphIndex = createGraphIndex(graph);
    const result = buildIntermediateModules({
      graph,
      graphIndex: graphIndex,
      outDir: "/out",
      gqlImportPath: "@/graphql-system",
      coreImportPath: "@soda-gql/core",
      evaluatorId: "test",
    });

    expect(result.size).toBe(1);
    expect(result.has("/src/a.ts")).toBe(true);

    const chunk = result.get("/src/a.ts");
    expect(chunk).toBeDefined();
    expect(chunk?.filePath).toBe("/src/a.ts");
    expect(chunk?.canonicalIds).toHaveLength(1);
    expect(chunk?.sourceCode).toContain("gql.default({ name: 'Foo' })");
  });

  test("should create multiple chunks for multiple files", () => {
    const graph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo", "gql.default({ name: 'Foo' })")],
      [createCanonicalId("/src/b.ts", "bar"), createTestNode("/src/b.ts", "bar", "gql.default({ name: 'Bar' })")],
    ]);

    const graphIndex = createGraphIndex(graph);
    const result = buildIntermediateModules({
      graph,
      graphIndex: graphIndex,
      outDir: "/out",
      gqlImportPath: "@/graphql-system",
      coreImportPath: "@soda-gql/core",
      evaluatorId: "test",
    });

    expect(result.size).toBe(2);
    expect(result.has("/src/a.ts")).toBe(true);
    expect(result.has("/src/b.ts")).toBe(true);
  });

  test("should group multiple definitions from same file in one chunk", () => {
    const graph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo", "gql.default({ name: 'Foo' })")],
      [createCanonicalId("/src/a.ts", "bar"), createTestNode("/src/a.ts", "bar", "gql.default({ name: 'Bar' })")],
    ]);

    const graphIndex = createGraphIndex(graph);
    const result = buildIntermediateModules({
      graph,
      graphIndex: graphIndex,
      outDir: "/out",
      gqlImportPath: "@/graphql-system",
      coreImportPath: "@soda-gql/core",
      evaluatorId: "test",
    });

    expect(result.size).toBe(1);

    const chunk = result.get("/src/a.ts");
    expect(chunk?.canonicalIds).toHaveLength(2);
    expect(chunk?.sourceCode).toContain("gql.default({ name: 'Foo' })");
    expect(chunk?.sourceCode).toContain("gql.default({ name: 'Bar' })");
  });

  test("should compute stable content hashes for unchanged chunks", () => {
    const graph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo", "gql.default({ name: 'Foo' })")],
    ]);

    const graphIndex = createGraphIndex(graph);
    const result1 = buildIntermediateModules({
      graph,
      graphIndex: graphIndex,
      outDir: "/out",
      gqlImportPath: "@/graphql-system",
      coreImportPath: "@soda-gql/core",
      evaluatorId: "test",
    });

    const result2 = buildIntermediateModules({
      graph,
      graphIndex: graphIndex,
      outDir: "/out",
      gqlImportPath: "@/graphql-system",
      coreImportPath: "@soda-gql/core",
      evaluatorId: "test",
    });

    const chunk1 = result1.get("/src/a.ts");
    const chunk2 = result2.get("/src/a.ts");

    expect(chunk1?.contentHash).toBeDefined();
    expect(chunk2?.contentHash).toBeDefined();
    if (chunk1?.contentHash && chunk2?.contentHash) {
      expect(chunk1.contentHash).toBe(chunk2.contentHash);
    }
  });

  test("should include chunk imports for dependencies", () => {
    const barId = createCanonicalId("/src/b.ts", "bar");
    const fooNode = createTestNode("/src/a.ts", "foo", "gql.default({ name: 'Foo' })", ["/src/b.ts"]);
    // Manually set dependency to the actual canonical ID
    (fooNode as any).dependencies = [barId];

    const graph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), fooNode],
      [barId, createTestNode("/src/b.ts", "bar", "gql.default({ name: 'Bar' })")],
    ]);

    const graphIndex = createGraphIndex(graph);
    const result = buildIntermediateModules({
      graph,
      graphIndex: graphIndex,
      outDir: "/out",
      gqlImportPath: "@/graphql-system",
      coreImportPath: "@soda-gql/core",
      evaluatorId: "test",
    });

    const chunkA = result.get("/src/a.ts");
    expect(chunkA?.imports).toContain("/src/b.ts");
  });
});
