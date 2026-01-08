import { describe, expect, test } from "bun:test";
import { computePackagesToBump, type DependencyGraph, type PackageInfo } from "./version-utils";

/**
 * Helper to create a mock dependency graph for testing
 */
const createMockGraph = (
  packages: Array<{ name: string; workspaceDeps: string[]; isPrivate?: boolean }>,
): DependencyGraph => {
  const packagesMap = new Map<string, PackageInfo>();
  const dependsOn = new Map<string, Set<string>>();
  const dependedBy = new Map<string, Set<string>>();

  for (const pkg of packages) {
    const deps = new Set(pkg.workspaceDeps);
    packagesMap.set(pkg.name, {
      name: pkg.name,
      dirName: pkg.name.replace("@soda-gql/", ""),
      packagePath: `packages/${pkg.name.replace("@soda-gql/", "")}/package.json`,
      packageDir: `packages/${pkg.name.replace("@soda-gql/", "")}`,
      version: "0.0.0",
      workspaceDeps: deps,
      isPrivate: pkg.isPrivate ?? false,
    });

    dependsOn.set(pkg.name, deps);

    for (const dep of deps) {
      if (!dependedBy.has(dep)) {
        dependedBy.set(dep, new Set());
      }
      dependedBy.get(dep)!.add(pkg.name);
    }
  }

  return { packages: packagesMap, dependsOn, dependedBy };
};

describe("computePackagesToBump", () => {
  test("returns all packages in the graph", () => {
    const graph = createMockGraph([
      { name: "@soda-gql/common", workspaceDeps: [] },
      { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
      { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/config"] },
    ]);

    const result = computePackagesToBump(graph);

    expect(result.size).toBe(3);
    expect(result).toContain("@soda-gql/common");
    expect(result).toContain("@soda-gql/config");
    expect(result).toContain("@soda-gql/builder");
  });

  test("returns empty set for empty graph", () => {
    const graph = createMockGraph([]);

    const result = computePackagesToBump(graph);

    expect(result.size).toBe(0);
  });
});
