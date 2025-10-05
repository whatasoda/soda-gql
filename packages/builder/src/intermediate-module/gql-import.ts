import { dirname, join, relative } from "node:path";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * Resolve import path from outDir to target file with proper ESM extension mapping.
 * Maps .ts → .js, .mts → .mjs, .cts → .cjs as per resolveImportPath from @soda-gql/config.
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

  // Map TypeScript extensions to JavaScript extensions
  if (relativePath.endsWith(".ts")) {
    relativePath = `${relativePath.slice(0, -3)}.js`;
  } else if (relativePath.endsWith(".mts")) {
    relativePath = `${relativePath.slice(0, -4)}.mjs`;
  } else if (relativePath.endsWith(".cts")) {
    relativePath = `${relativePath.slice(0, -4)}.cjs`;
  }

  return relativePath;
};

/**
 * Resolve the gqlImportPath using config's canonical graphqlSystemPath.
 */
export const resolveGqlImportPath = ({ config, outDir }: { config: ResolvedSodaGqlConfig; outDir: string }): string => {
  return resolveImportPath(outDir, config.graphqlSystemPath);
};

/**
 * Resolve the @soda-gql/core import path using config's canonical corePath.
 */
export const resolveCoreImportPath = ({ config, outDir }: { config: ResolvedSodaGqlConfig; outDir: string }): string => {
  // If corePath is a package name (starts with @), return as-is
  if (config.corePath.startsWith("@")) {
    return config.corePath;
  }
  return resolveImportPath(outDir, config.corePath);
};
