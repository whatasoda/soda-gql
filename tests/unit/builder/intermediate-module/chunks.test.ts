import { describe, expect, test } from "bun:test";
import type { DependencyGraph, DependencyGraphNode, ModuleSummary } from "@soda-gql/builder/dependency-graph";
import { buildGraphIndex } from "@soda-gql/builder/dependency-graph/patcher";
import { diffChunkManifests, planChunks } from "@soda-gql/builder/internal/intermediate-module/chunks";
import { createCanonicalId } from "@soda-gql/common";

const createTestNode = (filePath: string, localPath: string, deps: string[] = []): DependencyGraphNode => {
  const id = createCanonicalId(filePath, localPath);
  const summary: ModuleSummary = {
    filePath,
    runtimeImports: [],
    gqlExports: [id],
  };

  return {
    id,
    filePath,
    localPath,
    isExported: true,
    definition: {
      astPath: localPath,
      isTopLevel: true,
      isExported: true,
      expression: "",
      loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    },
    dependencies: deps.map((d) => createCanonicalId(...(d.split("::") as [string, string]))),
    moduleSummary: summary,
  };
};

describe("planChunks", () => {
  test("creates chunks from graph", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/b.ts", "bar", ["/a.ts::foo"]);

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);

    const index = buildGraphIndex(graph);
    const manifest = planChunks(graph, index, "/out");

    expect(manifest.chunks.size).toBe(2);
    expect(manifest.version).toBe(1);

    const chunkA = manifest.chunks.get("/a.ts");
    expect(chunkA).toBeDefined();
    expect(chunkA?.sourcePath).toBe("/a.ts");
    expect(chunkA?.canonicalIds).toEqual([node1.id]);
    expect(chunkA?.imports).toEqual([]);
    expect(chunkA?.outputPath).toContain("/out/chunks/");
    expect(chunkA?.outputPath).toEndWith(".mjs");

    const chunkB = manifest.chunks.get("/b.ts");
    expect(chunkB).toBeDefined();
    expect(chunkB?.sourcePath).toBe("/b.ts");
    expect(chunkB?.canonicalIds).toEqual([node2.id]);
    expect(chunkB?.imports).toEqual(["/a.ts"]);
  });

  test("produces stable hashes for unchanged content", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    graph.set(node1.id, node1);

    const index = buildGraphIndex(graph);
    const manifest1 = planChunks(graph, index, "/out");
    const manifest2 = planChunks(graph, index, "/out");

    const hash1 = manifest1.chunks.get("/a.ts")?.contentHash;
    const hash2 = manifest2.chunks.get("/a.ts")?.contentHash;

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    if (hash1 && hash2) {
      expect(hash1).toBe(hash2);
    }
  });

  test("produces different hashes when dependencies change", () => {
    const graph1: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo", []);
    graph1.set(node1.id, node1);

    const graph2: DependencyGraph = new Map();
    const node2 = createTestNode("/a.ts", "foo", ["/b.ts::bar"]);
    graph2.set(node2.id, node2);

    const index1 = buildGraphIndex(graph1);
    const index2 = buildGraphIndex(graph2);

    const manifest1 = planChunks(graph1, index1, "/out");
    const manifest2 = planChunks(graph2, index2, "/out");

    const hash1 = manifest1.chunks.get("/a.ts")?.contentHash;
    const hash2 = manifest2.chunks.get("/a.ts")?.contentHash;

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    expect(hash1).not.toBe(hash2);
  });

  test("groups multiple nodes from same file", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/a.ts", "bar");

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);

    const index = buildGraphIndex(graph);
    const manifest = planChunks(graph, index, "/out");

    expect(manifest.chunks.size).toBe(1);

    const chunkA = manifest.chunks.get("/a.ts");
    expect(chunkA?.canonicalIds).toHaveLength(2);
    expect(chunkA?.canonicalIds).toContain(node1.id);
    expect(chunkA?.canonicalIds).toContain(node2.id);
  });

  test("detects transitive imports", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/b.ts", "bar", ["/a.ts::foo"]);
    const node3 = createTestNode("/c.ts", "baz", ["/b.ts::bar"]);

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);
    graph.set(node3.id, node3);

    const index = buildGraphIndex(graph);
    const manifest = planChunks(graph, index, "/out");

    const chunkC = manifest.chunks.get("/c.ts");
    expect(chunkC?.imports).toEqual(["/b.ts"]);

    const chunkB = manifest.chunks.get("/b.ts");
    expect(chunkB?.imports).toEqual(["/a.ts"]);

    const chunkA = manifest.chunks.get("/a.ts");
    expect(chunkA?.imports).toEqual([]);
  });
});

describe("diffChunkManifests", () => {
  test("treats everything as added when old manifest is null", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    graph.set(node1.id, node1);

    const index = buildGraphIndex(graph);
    const manifest = planChunks(graph, index, "/out");

    const diff = diffChunkManifests(null, manifest);

    expect(diff.added.size).toBe(1);
    expect(diff.updated.size).toBe(0);
    expect(diff.removed.size).toBe(0);
    expect(diff.added.has("/a.ts")).toBe(true);
  });

  test("detects added chunks", () => {
    const graph1: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    graph1.set(node1.id, node1);

    const graph2: DependencyGraph = new Map();
    graph2.set(node1.id, node1);
    const node2 = createTestNode("/b.ts", "bar");
    graph2.set(node2.id, node2);

    const index1 = buildGraphIndex(graph1);
    const index2 = buildGraphIndex(graph2);

    const manifest1 = planChunks(graph1, index1, "/out");
    const manifest2 = planChunks(graph2, index2, "/out");

    const diff = diffChunkManifests(manifest1, manifest2);

    expect(diff.added.size).toBe(1);
    expect(diff.added.has("/b.ts")).toBe(true);
    expect(diff.updated.size).toBe(0);
    expect(diff.removed.size).toBe(0);
  });

  test("detects updated chunks", () => {
    const graph1: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo", []);
    graph1.set(node1.id, node1);

    const graph2: DependencyGraph = new Map();
    const node2 = createTestNode("/a.ts", "foo", ["/b.ts::bar"]);
    graph2.set(node2.id, node2);

    const index1 = buildGraphIndex(graph1);
    const index2 = buildGraphIndex(graph2);

    const manifest1 = planChunks(graph1, index1, "/out");
    const manifest2 = planChunks(graph2, index2, "/out");

    const diff = diffChunkManifests(manifest1, manifest2);

    expect(diff.added.size).toBe(0);
    expect(diff.updated.size).toBe(1);
    expect(diff.updated.has("/a.ts")).toBe(true);
    expect(diff.removed.size).toBe(0);
  });

  test("detects removed chunks", () => {
    const graph1: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/b.ts", "bar");
    graph1.set(node1.id, node1);
    graph1.set(node2.id, node2);

    const graph2: DependencyGraph = new Map();
    graph2.set(node1.id, node1);

    const index1 = buildGraphIndex(graph1);
    const index2 = buildGraphIndex(graph2);

    const manifest1 = planChunks(graph1, index1, "/out");
    const manifest2 = planChunks(graph2, index2, "/out");

    const diff = diffChunkManifests(manifest1, manifest2);

    expect(diff.added.size).toBe(0);
    expect(diff.updated.size).toBe(0);
    expect(diff.removed.size).toBe(1);
    expect(diff.removed.has("/b.ts")).toBe(true);
  });

  test("handles complex diff with all operations", () => {
    const graph1: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/b.ts", "bar");
    graph1.set(node1.id, node1);
    graph1.set(node2.id, node2);

    const graph2: DependencyGraph = new Map();
    const node1Updated = createTestNode("/a.ts", "foo", ["/c.ts::baz"]);
    const node3 = createTestNode("/c.ts", "baz");
    graph2.set(node1Updated.id, node1Updated);
    graph2.set(node3.id, node3);

    const index1 = buildGraphIndex(graph1);
    const index2 = buildGraphIndex(graph2);

    const manifest1 = planChunks(graph1, index1, "/out");
    const manifest2 = planChunks(graph2, index2, "/out");

    const diff = diffChunkManifests(manifest1, manifest2);

    expect(diff.added.has("/c.ts")).toBe(true);
    expect(diff.updated.has("/a.ts")).toBe(true);
    expect(diff.removed.has("/b.ts")).toBe(true);
  });

  test("no changes produces empty diff", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    graph.set(node1.id, node1);

    const index = buildGraphIndex(graph);
    const manifest1 = planChunks(graph, index, "/out");
    const manifest2 = planChunks(graph, index, "/out");

    const diff = diffChunkManifests(manifest1, manifest2);

    expect(diff.added.size).toBe(0);
    expect(diff.updated.size).toBe(0);
    expect(diff.removed.size).toBe(0);
  });
});
