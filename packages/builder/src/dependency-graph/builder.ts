import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";
import { normalizePath, resolveModuleSpecifier } from "./resolver";
import type { DependencyGraphError } from "./types";

export const validateModuleDependencies = (input: {
  analyses: Map<string, ModuleAnalysis>;
}): Result<null, DependencyGraphError> => {
  const moduleLookup = new Map<string, ModuleAnalysis>();
  input.analyses.forEach((analysis) => {
    moduleLookup.set(normalizePath(analysis.filePath), analysis);
  });

  // Validate that all relative imports can be resolved
  for (const analysis of input.analyses.values()) {
    const modulePath = normalizePath(analysis.filePath);

    for (const { source, isTypeOnly } of analysis.imports) {
      if (isTypeOnly) {
        continue;
      }

      // Only check relative imports (project modules)
      if (source.startsWith(".")) {
        const resolvedModule = resolveModuleSpecifier({ filePath: modulePath, specifier: source, analyses: moduleLookup });
        if (!resolvedModule) {
          // Import points to a module that doesn't exist in the analysis
          return err({
            code: "MISSING_IMPORT" as const,
            chain: [modulePath, source] as const,
          });
        }
      }
    }
  }

  return ok(null);
};
