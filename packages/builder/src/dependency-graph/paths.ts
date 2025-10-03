import { dirname, join, normalize, resolve as resolvePath } from "node:path";
import type { ModuleAnalysis } from "../ast";

const normalizePath = (value: string): string => normalize(value).replace(/\\/g, "/");

export const resolveModuleSpecifier = (
  currentFile: string,
  specifier: string,
  candidates: ReadonlyMap<string, ModuleAnalysis>,
): ModuleAnalysis | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = normalizePath(resolvePath(dirname(currentFile), specifier));
  const possible = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];

  for (const candidate of possible) {
    const module = candidates.get(normalizePath(candidate));
    if (module) {
      return module;
    }
  }

  return null;
};

export { normalizePath };
