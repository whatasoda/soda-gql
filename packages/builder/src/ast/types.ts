/**
 * Shared types and constants for module analyzers (TypeScript and SWC).
 */

import type { CanonicalId } from "@soda-gql/common";

// ============================================================================
// Diagnostic Types
// ============================================================================

/**
 * Diagnostic codes for invalid patterns detected during analysis.
 */
export type DiagnosticCode =
  // Import-level issues
  | "RENAMED_IMPORT" // gql as g
  | "STAR_IMPORT" // import * as gqlSystem
  | "DEFAULT_IMPORT" // import gql from "..."
  // Call-level issues
  | "MISSING_ARGUMENT" // gql.default()
  | "INVALID_ARGUMENT_TYPE" // gql.default("string")
  | "NON_MEMBER_CALLEE" // gql(...)
  | "COMPUTED_PROPERTY" // gql["default"](...)
  | "DYNAMIC_CALLEE" // (x || gql).default(...)
  | "OPTIONAL_CHAINING" // gql?.default(...)
  | "EXTRA_ARGUMENTS" // gql.default(fn, extra)
  | "SPREAD_ARGUMENT" // gql.default(...args)
  // Scope-level issues
  | "CLASS_PROPERTY"; // class property definitions

/**
 * Severity level for diagnostics.
 */
export type DiagnosticSeverity = "error" | "warning";

/**
 * Location information for a diagnostic.
 */
export type DiagnosticLocation = {
  readonly start: number;
  readonly end: number;
  readonly line?: number;
  readonly column?: number;
};

/**
 * A single diagnostic message from analysis.
 */
export type ModuleDiagnostic = {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly location: DiagnosticLocation;
  /** Additional context for some diagnostics */
  readonly context?: Readonly<Record<string, string>>;
};

// ============================================================================
// Module Analysis Types
// ============================================================================

export type ModuleDefinition = {
  readonly canonicalId: CanonicalId;
  /** AST-derived path uniquely identifying this definition's location (e.g., "MyComponent.useQuery.def") */
  readonly astPath: string;
  /**
   * Whether this definition is at the top level of the module (stack.length === 1 during AST traversal).
   * Invariant: if isExported is true, isTopLevel must also be true.
   */
  readonly isTopLevel: boolean;
  /**
   * Whether this definition is exported from the module.
   * Invariant: isExported can only be true when isTopLevel is true.
   */
  readonly isExported: boolean;
  /** The export binding name if this definition is exported */
  readonly exportBinding?: string;
  readonly expression: string;
};

export type ModuleImport = {
  readonly source: string;
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
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
  readonly diagnostics: readonly ModuleDiagnostic[];
};

export type AnalyzeModuleInput = {
  readonly filePath: string;
  readonly source: string;
};
