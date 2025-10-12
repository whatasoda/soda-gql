import { dirname, join, resolve } from "node:path";
import type { ModuleAnalysis } from "../../ast";

/**
 * Normalize path for consistent comparison.
 */
export const normalizePath = (value: string): string => {
  return value.replace(/\\/g, "/");
};

/**
 * Resolve a module specifier to an absolute file path.
 */
export const resolveImportPath = ({
  filePath,
  specifier,
  analyses,
}: {
  filePath: string;
  specifier: string;
  analyses: Map<string, ModuleAnalysis>;
}): string | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = normalizePath(resolve(dirname(filePath), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (analyses.has(normalized)) {
      return normalized;
    }
  }

  return null;
};
