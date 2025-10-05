import { dirname, join, relative } from "node:path";
import type { ResolvedSodaGqlConfig } from "./types";

/**
 * Resolve import path from outDir to a target file.
 * Returns a relative path suitable for ES module imports.
 */
export const resolveImportPathFromConfig = (config: ResolvedSodaGqlConfig, targetPath: string): string => {
  const { outDir } = config;

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

  // Remove /src/index suffix for cleaner imports
  if (relativePath.endsWith("/src/index")) {
    relativePath = relativePath.slice(0, -10);
  }

  return relativePath;
};

/**
 * Get the gql import path from config.
 */
export const getGqlImportPath = (config: ResolvedSodaGqlConfig): string => {
  return resolveImportPathFromConfig(config, config.graphqlSystemPath);
};

/**
 * Get the @soda-gql/core import path from config.
 */
export const getCoreImportPath = (config: ResolvedSodaGqlConfig): string => {
  return resolveImportPathFromConfig(config, config.corePath);
};
