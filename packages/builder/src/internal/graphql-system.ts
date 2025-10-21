/**
 * Helper for identifying graphql-system files and import specifiers.
 * Provides robust detection across symlinks, case-insensitive filesystems, and user-defined aliases.
 */

import { resolve } from "node:path";
import { resolveRelativeImportWithExistenceCheck } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

export type GraphqlSystemIdentifyHelper = {
  readonly isGraphqlSystemFile: (input: { filePath: string }) => boolean;
  readonly isGraphqlSystemImportSpecifier: (input: { filePath: string; specifier: string }) => boolean;
};

/**
 * Create a canonical file name getter based on platform.
 * On case-sensitive filesystems, paths are returned as-is.
 * On case-insensitive filesystems, paths are lowercased for comparison.
 */
const createGetCanonicalFileName = (useCaseSensitiveFileNames: boolean): ((path: string) => string) => {
  return useCaseSensitiveFileNames ? (path: string) => path : (path: string) => path.toLowerCase();
};

/**
 * Detect if the filesystem is case-sensitive.
 * We assume Unix-like systems are case-sensitive, and Windows is not.
 */
const getUseCaseSensitiveFileNames = (): boolean => {
  return process.platform !== "win32";
};

/**
 * Create a GraphqlSystemIdentifyHelper from the resolved config.
 * Uses canonical path comparison to handle casing, symlinks, and aliases.
 */
export const createGraphqlSystemIdentifyHelper = (config: ResolvedSodaGqlConfig): GraphqlSystemIdentifyHelper => {
  const getCanonicalFileName = createGetCanonicalFileName(getUseCaseSensitiveFileNames());

  const toCanonical = (file: string): string => {
    const resolved = resolve(file);
    return getCanonicalFileName(resolved);
  };

  // Derive graphql system path from outdir (assume index.ts as default entry)
  const graphqlSystemPath = resolve(config.outdir, "index.ts");
  const canonicalGraphqlSystemPath = toCanonical(graphqlSystemPath);

  // Build canonical alias map
  const canonicalAliases = new Set(config.graphqlSystemAliases.map((alias) => alias));

  return {
    isGraphqlSystemFile: ({ filePath }: { filePath: string }) => {
      return toCanonical(filePath) === canonicalGraphqlSystemPath;
    },
    isGraphqlSystemImportSpecifier: ({ filePath, specifier }: { filePath: string; specifier: string }) => {
      // Check against aliases first if configured
      if (canonicalAliases.has(specifier)) {
        return true;
      }

      // Only try to resolve relative imports (starting with . or ..)
      // External specifiers without an alias configured should not match
      if (!specifier.startsWith(".")) {
        return false;
      }

      // Try to resolve as relative import
      const resolved = resolveRelativeImportWithExistenceCheck({ filePath, specifier });
      if (!resolved) {
        return false;
      }

      return toCanonical(resolved) === canonicalGraphqlSystemPath;
    },
  };
};
