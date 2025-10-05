import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { DependencyGraph } from "../dependency-graph/types";

/**
 * Find workspace root by looking for package.json with workspaces field.
 * Starts from a sample file path and walks up the directory tree.
 */
const findWorkspaceRoot = (graph: DependencyGraph): string => {
  const paths = Array.from(graph.values()).map((node) => node.filePath);
  if (paths.length === 0) {
    return process.cwd();
  }

  // Start from first file and walk up
  let currentDir = dirname(paths[0] ?? process.cwd());
  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      // Check if it has workspaces field (monorepo root)
      try {
        const packageJson = JSON.parse(require("fs").readFileSync(packageJsonPath, "utf8"));
        if (packageJson.workspaces) {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }
    currentDir = dirname(currentDir);
  }

  // Fallback to common parent if no monorepo root found
  let commonPath = dirname(paths[0] ?? "");
  for (const path of paths.slice(1)) {
    if (!path) {
      continue;
    }
    while (!path.startsWith(commonPath)) {
      const parent = dirname(commonPath);
      if (parent === commonPath) {
        break;
      }
      commonPath = parent;
    }
  }

  return commonPath;
};

/**
 * Resolve import path to a package/file as a relative path.
 */
const resolveImportPath = (outDir: string, targetPath: string): string => {
  // Compute relative path from a temp file in outDir
  const tempFile = join(outDir, "temp.mjs");
  let relativePath = relative(dirname(tempFile), targetPath).replace(/\\/g, "/");

  if (relativePath.length === 0) {
    relativePath = "./index";
  }
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  // Remove .ts extension for imports
  if (relativePath.endsWith(".ts")) {
    relativePath = relativePath.slice(0, -3);
  }

  // Remove /src/index suffix and use package root
  if (relativePath.endsWith("/src/index")) {
    relativePath = relativePath.slice(0, -10); // Remove "/src/index"
  }

  return relativePath;
};

/**
 * Resolve the gqlImportPath for intermediate module code generation.
 *
 * Computes a relative path from outDir to graphql-system/index.ts if it exists,
 * otherwise returns the package alias as-is.
 */
export const resolveGqlImportPath = ({ graph, outDir }: { graph: DependencyGraph; outDir: string }): string => {
  const workspaceRoot = findWorkspaceRoot(graph);
  const graphqlSystemIndex = join(workspaceRoot, "graphql-system", "index.ts");

  return resolveImportPath(outDir, graphqlSystemIndex);
};

/**
 * Resolve the @soda-gql/core import path for intermediate module code generation.
 *
 * Computes a relative path from outDir to packages/core/src/index.ts if it exists,
 * otherwise returns "@soda-gql/core" as-is.
 */
export const resolveCoreImportPath = ({ graph, outDir }: { graph: DependencyGraph; outDir: string }): string => {
  const workspaceRoot = findWorkspaceRoot(graph);
  const coreIndex = join(workspaceRoot, "packages", "core", "src", "index.ts");

  return resolveImportPath(outDir, coreIndex);
};
