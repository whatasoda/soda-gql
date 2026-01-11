/**
 * Shared detection utilities for identifying invalid gql patterns.
 * Used by both TypeScript and SWC adapters, and exported for formatter consumption.
 */

import type { DiagnosticCode, DiagnosticLocation, DiagnosticSeverity, ModuleDiagnostic } from "../types";

// ============================================================================
// Diagnostic Factory
// ============================================================================

/**
 * Configuration for creating a diagnostic
 */
export type DiagnosticConfig = {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly location: DiagnosticLocation;
  readonly context?: Readonly<Record<string, string>>;
};

/**
 * Create a diagnostic with appropriate severity
 */
export const createDiagnostic = (config: DiagnosticConfig): ModuleDiagnostic => ({
  code: config.code,
  severity: getSeverity(config.code),
  message: config.message,
  location: config.location,
  context: config.context,
});

// ============================================================================
// Severity Classification
// ============================================================================

/**
 * Get severity for a diagnostic code.
 * - "error": Code will definitely not work
 * - "warning": Code might work but is unsupported/unreliable
 */
export const getSeverity = (code: DiagnosticCode): DiagnosticSeverity => {
  switch (code) {
    // Errors: code will definitely not work
    case "MISSING_ARGUMENT":
    case "INVALID_ARGUMENT_TYPE":
    case "NON_MEMBER_CALLEE":
    case "OPTIONAL_CHAINING":
    case "SPREAD_ARGUMENT":
      return "error";

    // Warnings: code might work but is unsupported
    case "RENAMED_IMPORT":
    case "STAR_IMPORT":
    case "DEFAULT_IMPORT":
    case "COMPUTED_PROPERTY":
    case "DYNAMIC_CALLEE":
    case "CLASS_PROPERTY":
    case "EXTRA_ARGUMENTS":
      return "warning";
  }
};

// ============================================================================
// Message Templates
// ============================================================================

type MessageContext = Readonly<Record<string, string>>;

/**
 * Diagnostic message templates for each code
 */
export const diagnosticMessages: Record<DiagnosticCode, (ctx?: MessageContext) => string> = {
  // Import-level
  RENAMED_IMPORT: (ctx) => `Import alias "${ctx?.importedAs ?? "?"}" not recognized - use "import { gql } from ..."`,
  STAR_IMPORT: (ctx) => `Namespace import "${ctx?.namespaceAlias ?? "?"}" not fully supported - use named import`,
  DEFAULT_IMPORT: () => `Default import not supported - use "import { gql } from ..."`,

  // Call-level
  MISSING_ARGUMENT: () => `gql definition requires a factory function argument`,
  INVALID_ARGUMENT_TYPE: (ctx) => `Expected arrow function, got ${ctx?.actualType ?? "unknown"}`,
  NON_MEMBER_CALLEE: () => `Cannot call gql directly - use gql.schemaName(...)`,
  COMPUTED_PROPERTY: () => `Computed property access not supported - use gql.schemaName(...)`,
  DYNAMIC_CALLEE: () => `Dynamic callee expression not supported`,
  OPTIONAL_CHAINING: () => `Optional chaining on gql not supported - use gql.schemaName(...) directly`,
  EXTRA_ARGUMENTS: (ctx) =>
    `gql definition only accepts one argument, ${ctx?.extraCount ?? "extra"} additional argument(s) ignored`,
  SPREAD_ARGUMENT: () => `Spread arguments not supported - use arrow function directly`,

  // Scope-level
  CLASS_PROPERTY: () => `Class property definitions may have inconsistent scope tracking`,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a diagnostic with a standard message
 */
export const createStandardDiagnostic = (
  code: DiagnosticCode,
  location: DiagnosticLocation,
  context?: MessageContext,
): ModuleDiagnostic => {
  return createDiagnostic({
    code,
    message: diagnosticMessages[code](context),
    location,
    context,
  });
};
