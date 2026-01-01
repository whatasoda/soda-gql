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
    test("does not cascade - returns only directly changed packages", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/config"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/common"]);
      const result = computePackagesToBump(directlyChanged, graph, "patch");

      expect(result).toEqual(new Set(["@soda-gql/common"]));
    });
  });

  describe("minor/major bump - forward cascade", () => {
    test("cascades to dependents (packages that depend ON changed packages)", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/config"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/common"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      // common → config → builder (forward cascade)
      expect(result).toContain("@soda-gql/common");
      expect(result).toContain("@soda-gql/config");
      expect(result).toContain("@soda-gql/builder");
      expect(result.size).toBe(3);
    });
  });

  describe("minor/major bump - backward cascade", () => {
    test("cascades to workspace dependencies (packages that bumped packages depend ON)", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/core", workspaceDeps: [] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/core"] },
        { name: "@soda-gql/cli", workspaceDeps: ["@soda-gql/builder"] },
      ]);

      // Only cli changed - no forward cascade since nothing depends on cli
      // But backward cascade should include: cli → builder → common, core
      const directlyChanged = new Set(["@soda-gql/cli"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      expect(result).toContain("@soda-gql/cli");
      expect(result).toContain("@soda-gql/builder");
      expect(result).toContain("@soda-gql/common");
      expect(result).toContain("@soda-gql/core");
      expect(result.size).toBe(4);
    });

    test("backward cascade is transitive", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/config"] },
        { name: "@soda-gql/cli", workspaceDeps: ["@soda-gql/builder"] },
      ]);

      // cli changed → backward cascade: cli → builder → config → common
      const directlyChanged = new Set(["@soda-gql/cli"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      expect(result).toContain("@soda-gql/cli");
      expect(result).toContain("@soda-gql/builder");
      expect(result).toContain("@soda-gql/config");
      expect(result).toContain("@soda-gql/common");
      expect(result.size).toBe(4);
    });
  });

  describe("bidirectional cascade", () => {
    test("combines forward and backward cascades", () => {
      // Graph:
      //   common ← config ← plugin-common ← babel-plugin
      //              ↑
      //           builder ← cli
      //              ↑
      //            core
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/core", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
        { name: "@soda-gql/builder", workspaceDeps: ["@soda-gql/common", "@soda-gql/core", "@soda-gql/config"] },
        { name: "@soda-gql/plugin-common", workspaceDeps: ["@soda-gql/builder", "@soda-gql/config"] },
        { name: "@soda-gql/cli", workspaceDeps: ["@soda-gql/builder"] },
        { name: "@soda-gql/babel-plugin", workspaceDeps: ["@soda-gql/plugin-common"] },
      ]);

      // builder changed
      // Forward: builder → cli, plugin-common → babel-plugin
      // Backward: builder → common, core, config
      const directlyChanged = new Set(["@soda-gql/builder"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      // All packages should be bumped
      expect(result.size).toBe(7);
      expect(result).toContain("@soda-gql/common");
      expect(result).toContain("@soda-gql/core");
      expect(result).toContain("@soda-gql/config");
      expect(result).toContain("@soda-gql/builder");
      expect(result).toContain("@soda-gql/plugin-common");
      expect(result).toContain("@soda-gql/cli");
      expect(result).toContain("@soda-gql/babel-plugin");
    });

    test("leaf package with no dependents only bumps itself", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/formatter", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
      ]);

      // formatter changed - no deps, no dependents
      const directlyChanged = new Set(["@soda-gql/formatter"]);
      const result = computePackagesToBump(directlyChanged, graph, "minor");

      expect(result).toEqual(new Set(["@soda-gql/formatter"]));
    });
  });

  describe("major bump", () => {
    test("behaves same as minor for cascade", () => {
      const graph = createMockGraph([
        { name: "@soda-gql/common", workspaceDeps: [] },
        { name: "@soda-gql/config", workspaceDeps: ["@soda-gql/common"] },
      ]);

      const directlyChanged = new Set(["@soda-gql/config"]);
      const minorResult = computePackagesToBump(directlyChanged, graph, "minor");
      const majorResult = computePackagesToBump(directlyChanged, graph, "major");

      expect(minorResult).toEqual(majorResult);
    });
  });
});
