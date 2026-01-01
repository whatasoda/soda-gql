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
  describe("patch bump", () => {
    test("returns only directly changed packages", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/config"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/common"]);
      const result = computePackagesToBump(directlyChanged, graph, "patch");

      expect(result).toEqual(new Set(["@soda-gql/common"]));
    });

    test("returns multiple directly changed packages", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/config"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/common", "@soda-gql/builder"]);
      const result = computePackagesToBump(directlyChanged, graph, "patch");

      expect(result).toEqual(new Set(["@soda-gql/common", "@soda-gql/builder"]));
    });
  });

  describe("minor bump", () => {
    test("returns all packages regardless of changes", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/config"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/common"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      expect(result.size).toBe(3);
      expect(result).toContain("@soda-gql/common");
      expect(result).toContain("@soda-gql/config");
      expect(result).toContain("@soda-gql/builder");
    });

    test("returns all packages even when only leaf package changed", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/cli", workspaceDeps: ["@soda-gql/config"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/cli"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      expect(result.size).toBe(3);
      expect(result).toContain("@soda-gql/common");
      expect(result).toContain("@soda-gql/config");
      expect(result).toContain("@soda-gql/cli");
    });
  });

  describe("major bump", () => {
    test("behaves same as minor - returns all packages", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/config"]);
      const minorResult = computePackagesToBump(directlyChanged, graph, "minor");
      const majorResult = computePackagesToBump(directlyChanged, graph, "major");

      expect(minorResult).toEqual(majorResult);
      expect(majorResult.size).toBe(2);
    });
  });
});
