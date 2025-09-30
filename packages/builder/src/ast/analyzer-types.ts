/**
 * Shared types and constants for module analyzers (TypeScript and SWC).
 */

export type SourcePosition = {
  readonly line: number;
  readonly column: number;
};

export type SourceLocation = {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
};

export type GqlDefinitionKind = "model" | "slice" | "operation";

export type ModuleDefinition = {
  readonly kind: GqlDefinitionKind;
  readonly exportName: string;
  readonly schemaName?: string;
  readonly loc: SourceLocation;
  readonly references: readonly string[];
  readonly expression: string;
};

export type ModuleDiagnostic = {
  readonly code: "NON_TOP_LEVEL_DEFINITION";
  readonly message: string;
  readonly loc: SourceLocation;
};

export type ModuleImport = {
  readonly source: string;
  readonly imported: string;
  readonly local: string;
  readonly kind: "named" | "namespace" | "default";
  readonly isTypeOnly: boolean;
};

export type ModuleExport =
  | {
      readonly kind: "named";
      readonly exported: string;
      readonly local: string;
      readonly source?: undefined;
      readonly isTypeOnly: boolean;
    }
  | {
      readonly kind: "reexport";
      readonly exported: string;
      readonly source: string;
      readonly local?: string;
      readonly isTypeOnly: boolean;
    };

export type ModuleAnalysis = {
  readonly filePath: string;
  readonly sourceHash: string;
  readonly definitions: readonly ModuleDefinition[];
  readonly diagnostics: readonly ModuleDiagnostic[];
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
};

export type AnalyzeModuleInput = {
  readonly filePath: string;
  readonly source: string;
};

/**
 * Maps GraphQL helper method names to their definition kinds.
 * Used by both TypeScript and SWC analyzers.
 */
export const gqlDefinitionKinds: Record<string, GqlDefinitionKind> = {
  model: "model",
  // Legacy patterns
  querySlice: "slice",
  query: "operation",
  mutation: "operation",
  subscription: "operation",
};
