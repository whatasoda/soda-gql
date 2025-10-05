import { describe, expect, test } from "bun:test";
import { createCanonicalId } from "../../../../packages/builder/src/canonical-id/canonical-id";
import { applyGraphPatch, buildGraphIndex, type DependencyGraphPatch, type GraphIndex } from "../../../../packages/builder/src/dependency-graph/patcher";
import type { DependencyGraph, DependencyGraphNode, ModuleSummary } from "../../../../packages/builder/src/dependency-graph/types";

const createTestNode = (filePath: string, localPath: string, deps: string[] = []): DependencyGraphNode => {
  const id = createCanonicalId(filePath, localPath);
  const summary: ModuleSummary = {
    filePath,
    runtimeImports: [],
    gqlExports: [],
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

describe("buildGraphIndex", () => {
  test("builds index from graph", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/a.ts", "bar");
    const node3 = createTestNode("/b.ts", "baz");

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);
    graph.set(node3.id, node3);

    const index = buildGraphIndex(graph);

    expect(index.size).toBe(2);
    expect(index.get("/a.ts")?.size).toBe(2);
    expect(index.get("/b.ts")?.size).toBe(1);
    expect(index.get("/a.ts")?.has(node1.id)).toBe(true);
    expect(index.get("/a.ts")?.has(node2.id)).toBe(true);
    expect(index.get("/b.ts")?.has(node3.id)).toBe(true);
  });

  test("handles empty graph", () => {
    const graph: DependencyGraph = new Map();
    const index = buildGraphIndex(graph);

    expect(index.size).toBe(0);
  });
});

describe("applyGraphPatch", () => {
  test("removes entire module", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/b.ts", "bar");

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);

    const index = buildGraphIndex(graph);

    const patch: DependencyGraphPatch = {
      removedModules: new Set(["/a.ts"]),
      removedNodes: new Set(),
      upsertNodes: new Map(),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(1);
    expect(graph.has(node1.id)).toBe(false);
    expect(graph.has(node2.id)).toBe(true);
    expect(index.size).toBe(1);
    expect(index.has("/a.ts")).toBe(false);
    expect(index.has("/b.ts")).toBe(true);
  });

  test("removes individual node", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/a.ts", "bar");

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);

    const index = buildGraphIndex(graph);

    const patch: DependencyGraphPatch = {
      removedModules: new Set(),
      removedNodes: new Set([node1.id]),
      upsertNodes: new Map(),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(1);
    expect(graph.has(node1.id)).toBe(false);
    expect(graph.has(node2.id)).toBe(true);
    expect(index.get("/a.ts")?.size).toBe(1);
    expect(index.get("/a.ts")?.has(node2.id)).toBe(true);
  });

  test("removes module when last node is removed", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");

    graph.set(node1.id, node1);

    const index = buildGraphIndex(graph);

    const patch: DependencyGraphPatch = {
      removedModules: new Set(),
      removedNodes: new Set([node1.id]),
      upsertNodes: new Map(),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(0);
    expect(index.size).toBe(0);
  });

  test("upserts new node", () => {
    const graph: DependencyGraph = new Map();
    const index: GraphIndex = new Map();

    const newNode = createTestNode("/a.ts", "foo");

    const patch: DependencyGraphPatch = {
      removedModules: new Set(),
      removedNodes: new Set(),
      upsertNodes: new Map([[newNode.id, newNode]]),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(1);
    expect(graph.has(newNode.id)).toBe(true);
    expect(index.size).toBe(1);
    expect(index.get("/a.ts")?.has(newNode.id)).toBe(true);
  });

  test("updates existing node", () => {
    const graph: DependencyGraph = new Map();
    const oldNode = createTestNode("/a.ts", "foo", ["/b.ts::bar"]);

    graph.set(oldNode.id, oldNode);

    const index = buildGraphIndex(graph);

    const updatedNode = createTestNode("/a.ts", "foo", ["/c.ts::baz"]);

    const patch: DependencyGraphPatch = {
      removedModules: new Set(),
      removedNodes: new Set(),
      upsertNodes: new Map([[updatedNode.id, updatedNode]]),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(1);
    expect(graph.get(oldNode.id)?.dependencies).toEqual(updatedNode.dependencies);
  });

  test("handles complex patch with multiple operations", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo");
    const node2 = createTestNode("/b.ts", "bar");
    const node3 = createTestNode("/c.ts", "baz");

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);
    graph.set(node3.id, node3);

    const index = buildGraphIndex(graph);

    const newNode = createTestNode("/d.ts", "qux");
    const updatedNode2 = createTestNode("/b.ts", "bar", ["/d.ts::qux"]);

    const patch: DependencyGraphPatch = {
      removedModules: new Set(["/a.ts"]),
      removedNodes: new Set([node3.id]),
      upsertNodes: new Map([
        [newNode.id, newNode],
        [updatedNode2.id, updatedNode2],
      ]),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(2); // removed a.ts and c.ts, added d.ts, updated b.ts
    expect(graph.has(node1.id)).toBe(false);
    expect(graph.has(node3.id)).toBe(false);
    expect(graph.has(updatedNode2.id)).toBe(true);
    expect(graph.has(newNode.id)).toBe(true);
    expect(index.size).toBe(2);
    expect(index.has("/a.ts")).toBe(false);
    expect(index.has("/c.ts")).toBe(false);
    expect(index.has("/b.ts")).toBe(true);
    expect(index.has("/d.ts")).toBe(true);
  });

  test("handles dependency rewiring", () => {
    const graph: DependencyGraph = new Map();
    const node1 = createTestNode("/a.ts", "foo", ["/b.ts::bar"]);
    const node2 = createTestNode("/b.ts", "bar");

    graph.set(node1.id, node1);
    graph.set(node2.id, node2);

    const index = buildGraphIndex(graph);

    // Remove b.ts and update a.ts to depend on c.ts instead
    const node3 = createTestNode("/c.ts", "bar");
    const updatedNode1 = createTestNode("/a.ts", "foo", ["/c.ts::bar"]);

    const patch: DependencyGraphPatch = {
      removedModules: new Set(["/b.ts"]),
      removedNodes: new Set(),
      upsertNodes: new Map([
        [updatedNode1.id, updatedNode1],
        [node3.id, node3],
      ]),
      moduleSummaries: new Map(),
    };

    applyGraphPatch(graph, index, patch);

    expect(graph.size).toBe(2);
    expect(graph.has(node2.id)).toBe(false);
    expect(graph.get(updatedNode1.id)?.dependencies).toContain(node3.id);
    expect(index.has("/b.ts")).toBe(false);
    expect(index.has("/c.ts")).toBe(true);
  });
});
