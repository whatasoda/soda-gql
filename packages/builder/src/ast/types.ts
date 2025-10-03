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

export type ModuleDefinition = {
  /** @deprecated Use astPath instead. Kept for backward compatibility during migration. */
  readonly exportName: string;
  /** AST-derived path uniquely identifying this definition's location (e.g., "MyComponent.useQuery.def") */
  readonly astPath: string;
  /** Whether this definition is at the top level of the module */
  readonly isTopLevel: boolean;
  /** Whether this definition is exported from the module */
  readonly isExported: boolean;
  /** The export binding name if this definition is exported */
  readonly exportBinding?: string;
  readonly loc: SourceLocation;
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
  readonly signature: string;
  readonly definitions: readonly ModuleDefinition[];
  readonly diagnostics: readonly ModuleDiagnostic[];
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
};

export type AnalyzeModuleInput = {
  readonly filePath: string;
  readonly source: string;
};
