import { type AliasResolver, isRelativeSpecifier, resolveRelativeImportWithReferences } from "@soda-gql/common";
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
  aliasResolver,
}: {
  analyses: Map<string, ModuleAnalysis>;
  graphqlSystemHelper: GraphqlSystemIdentifyHelper;
  aliasResolver?: AliasResolver;
}): Result<null, DependencyGraphError> => {
  for (const analysis of analyses.values()) {
    for (const { source, isTypeOnly } of analysis.imports) {
      if (isTypeOnly) {
        continue;
      }

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
      } else if (aliasResolver) {
        // Validate alias-resolved imports: if the alias resolves to a local file,
        // it must exist in analyses. Unresolved aliases are external packages.
        const aliasResolved = aliasResolver.resolve(source);
        if (aliasResolved && !analyses.has(aliasResolved)) {
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
