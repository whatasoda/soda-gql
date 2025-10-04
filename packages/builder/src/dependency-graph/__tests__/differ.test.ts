import { describe, expect, test } from "bun:test";
import { createCanonicalId } from "../../canonical-id/canonical-id";
import { diffDependencyGraphs } from "../differ";
import type { DependencyGraph, DependencyGraphNode } from "../types";

const createTestNode = (filePath: string, localPath: string, dependencies: string[] = []): DependencyGraphNode => {
  const id = createCanonicalId(filePath, localPath);
  return {
    id,
    filePath,
    localPath,
    isExported: true,
    definition: {
      astPath: "",
      expression: "test",
      range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    },
    dependencies: dependencies.map((dep) => createCanonicalId(dep, "default")),
    moduleSummary: {
      filePath,
      runtimeImports: [],
      gqlExports: [],
    },
  };
};

describe("diffDependencyGraphs", () => {
  test("should detect added nodes", () => {
    const oldGraph: DependencyGraph = new Map();
    const newGraph: DependencyGraph = new Map([[createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")]]);

    const patch = diffDependencyGraphs(oldGraph, newGraph);

    expect(patch.removedModules.size).toBe(0);
    expect(patch.removedNodes.size).toBe(0);
    expect(patch.upsertNodes.size).toBe(1);
    expect(patch.upsertNodes.has(createCanonicalId("/src/a.ts", "foo"))).toBe(true);
    expect(patch.moduleSummaries.size).toBe(1);
    expect(patch.moduleSummaries.has("/src/a.ts")).toBe(true);
  });

  test("should detect removed nodes", () => {
    const oldGraph: DependencyGraph = new Map([[createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")]]);
    const newGraph: DependencyGraph = new Map();

    const patch = diffDependencyGraphs(oldGraph, newGraph);

    expect(patch.removedModules.size).toBe(1);
    expect(patch.removedModules.has("/src/a.ts")).toBe(true);
    expect(patch.removedNodes.size).toBe(1);
    expect(patch.removedNodes.has(createCanonicalId("/src/a.ts", "foo"))).toBe(true);
    expect(patch.upsertNodes.size).toBe(0);
    expect(patch.moduleSummaries.size).toBe(0);
  });

  test("should detect updated nodes", () => {
    const oldNode = createTestNode("/src/a.ts", "foo");
    const newNode = createTestNode("/src/a.ts", "foo", ["/src/b.ts"]);

    const oldGraph: DependencyGraph = new Map([[oldNode.id, oldNode]]);
    const newGraph: DependencyGraph = new Map([[newNode.id, newNode]]);

    const patch = diffDependencyGraphs(oldGraph, newGraph);

    expect(patch.removedModules.size).toBe(0);
    expect(patch.removedNodes.size).toBe(0);
    expect(patch.upsertNodes.size).toBe(1);
    expect(patch.upsertNodes.get(newNode.id)).toBe(newNode);
    expect(patch.moduleSummaries.size).toBe(1);
  });

  test("should detect module removal when all nodes removed", () => {
    const oldGraph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")],
      [createCanonicalId("/src/a.ts", "bar"), createTestNode("/src/a.ts", "bar")],
    ]);
    const newGraph: DependencyGraph = new Map();

    const patch = diffDependencyGraphs(oldGraph, newGraph);

    expect(patch.removedModules.has("/src/a.ts")).toBe(true);
    expect(patch.removedNodes.size).toBe(2);
  });

  test("should not mark module as removed if some nodes remain", () => {
    const oldGraph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")],
      [createCanonicalId("/src/a.ts", "bar"), createTestNode("/src/a.ts", "bar")],
    ]);
    const newGraph: DependencyGraph = new Map([[createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")]]);

    const patch = diffDependencyGraphs(oldGraph, newGraph);

    expect(patch.removedModules.size).toBe(0);
    expect(patch.removedNodes.size).toBe(1);
    expect(patch.removedNodes.has(createCanonicalId("/src/a.ts", "bar"))).toBe(true);
    expect(patch.upsertNodes.size).toBe(0);
  });

  test("should handle complex diff with all operations", () => {
    const oldGraph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")],
      [createCanonicalId("/src/b.ts", "bar"), createTestNode("/src/b.ts", "bar")],
    ]);

    const newGraph: DependencyGraph = new Map([
      [createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo", ["/src/c.ts"])], // Updated
      [createCanonicalId("/src/c.ts", "baz"), createTestNode("/src/c.ts", "baz")], // Added
    ]);

    const patch = diffDependencyGraphs(oldGraph, newGraph);

    // b.ts module removed
    expect(patch.removedModules.has("/src/b.ts")).toBe(true);
    expect(patch.removedNodes.has(createCanonicalId("/src/b.ts", "bar"))).toBe(true);

    // a.ts::foo updated
    expect(patch.upsertNodes.has(createCanonicalId("/src/a.ts", "foo"))).toBe(true);

    // c.ts::baz added
    expect(patch.upsertNodes.has(createCanonicalId("/src/c.ts", "baz"))).toBe(true);

    // Module summaries for changed files
    expect(patch.moduleSummaries.has("/src/a.ts")).toBe(true);
    expect(patch.moduleSummaries.has("/src/c.ts")).toBe(true);
  });

  test("should return empty patch when graphs are identical", () => {
    const graph: DependencyGraph = new Map([[createCanonicalId("/src/a.ts", "foo"), createTestNode("/src/a.ts", "foo")]]);

    const patch = diffDependencyGraphs(graph, graph);

    expect(patch.removedModules.size).toBe(0);
    expect(patch.removedNodes.size).toBe(0);
    expect(patch.upsertNodes.size).toBe(0);
    expect(patch.moduleSummaries.size).toBe(0);
  });
});
