import { isRelativeSpecifier, resolveRelativeImportWithReferences } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";
import type { GraphqlSystemIdentifyHelper } from "../internal/graphql-system";

export type DependencyGraphError = {
  readonly code: "MISSING_IMPORT";
  readonly chain: readonly [importingFile: string, importSpecifier: string];
};

export const validateModuleDependencies = ({
  analyses,
  graphqlSystemHelper,
}: {
  analyses: Map<string, ModuleAnalysis>;
  graphqlSystemHelper: GraphqlSystemIdentifyHelper;
}): Result<null, DependencyGraphError> => {
  for (const analysis of analyses.values()) {
    for (const { source, isTypeOnly } of analysis.imports) {
      if (isTypeOnly) {
        continue;
      }

      // Only check relative imports (project modules)
      if (isRelativeSpecifier(source)) {
        // Skip graphql-system imports - they are not part of the analyzed modules
        if (graphqlSystemHelper.isGraphqlSystemImportSpecifier({ filePath: analysis.filePath, specifier: source })) {
          continue;
        }

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
