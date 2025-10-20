/**
 * Core analyzer logic that orchestrates the analysis pipeline.
 * Adapters (TypeScript, SWC, etc.) implement the adapter interface to plug into this pipeline.
 */

import { getPortableHasher } from "@soda-gql/common";
import type { GraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import type { AnalyzeModuleInput, ModuleAnalysis, ModuleDefinition, ModuleDiagnostic, ModuleExport, ModuleImport } from "./types";

/**
 * Adapter interface that each parser implementation (TS, SWC) must provide.
 * TFile: The parsed AST root type (e.g., ts.SourceFile, swc.Module)
 * THandle: A handle type for tracking analyzed call expressions (e.g., ts.CallExpression)
 */
export interface AnalyzerAdapter<TFile, THandle> {
  /**
   * Parse source code into an AST.
   */
  parse(input: AnalyzeModuleInput): TFile | null;

  /**
   * Collect identifiers imported from /graphql-system that represent gql APIs.
   * Uses GraphqlSystemIdentifyHelper to properly identify graphql-system imports.
   */
  collectGqlIdentifiers(file: TFile, helper: GraphqlSystemIdentifyHelper): ReadonlySet<string>;

  /**
   * Collect all module imports.
   */
  collectImports(file: TFile): readonly ModuleImport[];

  /**
   * Collect all module exports.
   */
  collectExports(file: TFile): readonly ModuleExport[];

  /**
   * Collect all GraphQL definitions (exported, non-exported, top-level, nested).
   * Returns both the definitions and handles for tracking which calls were processed.
   */
  collectDefinitions(
    file: TFile,
    context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly imports: readonly ModuleImport[];
      readonly exports: readonly ModuleExport[];
      readonly source: string;
    },
  ): {
    readonly definitions: readonly ModuleDefinition[];
    readonly handles: readonly THandle[];
  };

  /**
   * Collect diagnostics for any gql calls that weren't at the top level.
   */
  collectDiagnostics(
    file: TFile,
    context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly handledCalls: readonly THandle[];
      readonly source: string;
    },
  ): readonly ModuleDiagnostic[];
}

/**
 * Core analyzer function that orchestrates the analysis pipeline.
 * Adapters implement the AnalyzerAdapter interface to provide parser-specific logic.
 */
export const analyzeModuleCore = <TFile, THandle>(
  input: AnalyzeModuleInput,
  adapter: AnalyzerAdapter<TFile, THandle>,
  graphqlHelper: GraphqlSystemIdentifyHelper,
): ModuleAnalysis => {
  // Parse source
  const hasher = getPortableHasher();
  const signature = hasher.hash(input.source, "xxhash");

  const file = adapter.parse(input);
  if (!file) {
    return {
      filePath: input.filePath,
      signature,
      definitions: [],
      diagnostics: [],
      imports: [],
      exports: [],
    };
  }

  // Collect identifiers, imports, and exports
  const gqlIdentifiers = adapter.collectGqlIdentifiers(file, graphqlHelper);
  const imports = adapter.collectImports(file);
  const exports = adapter.collectExports(file);

  // Collect definitions
  const { definitions, handles } = adapter.collectDefinitions(file, {
    gqlIdentifiers,
    imports,
    exports,
    source: input.source,
  });

  // Collect diagnostics
  const diagnostics = adapter.collectDiagnostics(file, {
    gqlIdentifiers,
    handledCalls: handles,
    source: input.source,
  });

  return {
    filePath: input.filePath,
    signature,
    definitions,
    diagnostics,
    imports,
    exports,
  };
};
