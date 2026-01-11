/**
 * Core analyzer logic that orchestrates the analysis pipeline.
 * Adapters (TypeScript, SWC, etc.) implement the adapter interface to plug into this pipeline.
 */

import { getPortableHasher } from "@soda-gql/common";
import type { GraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import type { AnalyzeModuleInput, ModuleAnalysis, ModuleDefinition, ModuleDiagnostic, ModuleExport, ModuleImport } from "./types";

/**
 * Result of analyzing a module, containing all collected data.
 */
export type AnalyzerResult = {
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
  readonly definitions: readonly ModuleDefinition[];
  readonly diagnostics: readonly ModuleDiagnostic[];
};

/**
 * Adapter interface that each parser implementation (TS, SWC) must provide.
 * The analyze method parses and collects all data in one pass, allowing the AST
 * to be released immediately after analysis completes.
 */
export interface AnalyzerAdapter {
  /**
   * Parse source code into an AST, collect all required data, and return results.
   * The AST is kept within this function's scope and released after analysis.
   * This design enables early garbage collection of AST objects.
   */
  analyze(input: AnalyzeModuleInput, helper: GraphqlSystemIdentifyHelper): AnalyzerResult | null;
}

/**
 * Core analyzer function that orchestrates the analysis pipeline.
 * Adapters implement the AnalyzerAdapter interface to provide parser-specific logic.
 */
export const analyzeModuleCore = (
  input: AnalyzeModuleInput,
  adapter: AnalyzerAdapter,
  graphqlHelper: GraphqlSystemIdentifyHelper,
): ModuleAnalysis => {
  const hasher = getPortableHasher();
  const signature = hasher.hash(input.source, "xxhash");

  // Delegate all analysis to the adapter - AST is created and released within analyze()
  const result = adapter.analyze(input, graphqlHelper);

  if (!result) {
    return {
      filePath: input.filePath,
      signature,
      definitions: [],
      imports: [],
      exports: [],
      diagnostics: [],
    };
  }

  return {
    filePath: input.filePath,
    signature,
    definitions: result.definitions,
    imports: result.imports,
    exports: result.exports,
    diagnostics: result.diagnostics,
  };
};
