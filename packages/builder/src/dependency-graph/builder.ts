import { isRelativeSpecifier, normalizePath, resolveRelativeImportWithReferences } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";

export type DependencyGraphError = {
  readonly code: "MISSING_IMPORT";
  readonly chain: readonly [importingFile: string, importSpecifier: string];
};

export const validateModuleDependencies = ({
  analyses,
}: {
  analyses: Map<string, ModuleAnalysis>;
}): Result<null, DependencyGraphError> => {
  for (const analysis of analyses.values()) {
    for (const { source, isTypeOnly } of analysis.imports) {
      if (isTypeOnly) {
        continue;
      }

      // Only check relative imports (project modules)
      if (isRelativeSpecifier(source)) {
        const resolvedModule = resolveRelativeImportWithReferences({
          filePath: analysis.filePath,
          specifier: source,
          references: analyses,
        });
        if (!resolvedModule) {
          // Import points to a module that doesn't exist in the analysis
          return err({
            code: "MISSING_IMPORT" as const,
            chain: [analysis.filePath, source] as const,
          });
        }
      }
    }
  }

  return ok(null);
};
