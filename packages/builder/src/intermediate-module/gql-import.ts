import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { DependencyGraph } from "../dependency-graph/types";

/**
 * Find workspace root from dependency graph
 */
const findWorkspaceRoot = (graph: DependencyGraph): string => {
  const paths = Array.from(graph.keys()).map((node) => node.filePath);
  if (paths.length === 0) {
    return process.cwd();
  }

  // Find common parent directory
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
 * Resolve the gqlImportPath for intermediate module code generation.
 *
 * Computes a relative path from outDir to graphql-system/index.ts if it exists,
 * otherwise falls back to "@/graphql-system" alias.
 */
export const resolveGqlImportPath = ({ graph, outDir }: { graph: DependencyGraph; outDir: string }): string => {
  const workspaceRoot = findWorkspaceRoot(graph);
  const graphqlSystemIndex = join(workspaceRoot, "graphql-system", "index.ts");

  if (!existsSync(graphqlSystemIndex)) {
    return "@/graphql-system";
  }

  // Compute relative path from a temp file in outDir
  const tempFile = join(outDir, "temp.mjs");
  let relativePath = relative(dirname(tempFile), graphqlSystemIndex).replace(/\\/g, "/");

  if (relativePath.length === 0) {
    relativePath = "./index.ts";
  }
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  // Remove .ts extension
  return relativePath.endsWith(".ts") ? relativePath.slice(0, -3) : relativePath;
};
