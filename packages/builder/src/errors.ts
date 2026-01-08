import { err, type Result } from "neverthrow";

/**
 * Comprehensive error code taxonomy for Builder operations.
 */
export type BuilderErrorCode =
  // Input/Configuration errors
  | "ENTRY_NOT_FOUND"
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  // Discovery errors
  | "DISCOVERY_IO_ERROR"
  | "FINGERPRINT_FAILED"
  | "UNSUPPORTED_ANALYZER"
  // Canonical ID errors
  | "CANONICAL_PATH_INVALID"
  | "CANONICAL_SCOPE_MISMATCH"
  // Graph/Analysis errors
  | "GRAPH_CIRCULAR_DEPENDENCY"
  | "GRAPH_MISSING_IMPORT"
  | "DOC_DUPLICATE"
  // Emission/IO errors
  | "WRITE_FAILED"
  | "CACHE_CORRUPTED"
  // Runtime evaluation errors
  | "RUNTIME_MODULE_LOAD_FAILED"
  | "ARTIFACT_REGISTRATION_FAILED"
  | "ELEMENT_EVALUATION_FAILED"
  // Internal invariant violations
  | "INTERNAL_INVARIANT"
  // Schema validation errors
  | "SCHEMA_NOT_FOUND";

/**
 * Structured error type for all Builder operations.
 */
export type BuilderError =
  // Input/Configuration
  | {
      readonly code: "ENTRY_NOT_FOUND";
      readonly message: string;
      readonly entry: string;
    }
  | {
      readonly code: "CONFIG_NOT_FOUND";
      readonly message: string;
      readonly path: string;
    }
  | {
      readonly code: "CONFIG_INVALID";
      readonly message: string;
      readonly path: string;
      readonly cause?: unknown;
    }
  // Discovery
  | {
      readonly code: "DISCOVERY_IO_ERROR";
      readonly message: string;
      readonly path: string;
      readonly errno?: string | number;
      readonly cause?: unknown;
    }
  | {
      readonly code: "FINGERPRINT_FAILED";
      readonly message: string;
      readonly filePath: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: "UNSUPPORTED_ANALYZER";
      readonly message: string;
      readonly analyzer: string;
    }
  // Canonical ID
  | {
      readonly code: "CANONICAL_PATH_INVALID";
      readonly message: string;
      readonly path: string;
      readonly reason?: string;
    }
  | {
      readonly code: "CANONICAL_SCOPE_MISMATCH";
      readonly message: string;
      readonly expected: string;
      readonly actual: string;
    }
  // Graph/Analysis
  | {
      readonly code: "GRAPH_CIRCULAR_DEPENDENCY";
      readonly message: string;
      readonly chain: readonly string[];
    }
  | {
      readonly code: "GRAPH_MISSING_IMPORT";
      readonly message: string;
      readonly importer: string;
      readonly importee: string;
    }
  | {
      readonly code: "DOC_DUPLICATE";
      readonly message: string;
      readonly name: string;
      readonly sources: readonly string[];
    }
  // Emission/IO
  | {
      readonly code: "WRITE_FAILED";
      readonly message: string;
      readonly outPath: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: "CACHE_CORRUPTED";
      readonly message: string;
      readonly cachePath?: string;
      readonly cause?: unknown;
    }
  // Runtime evaluation
  | {
      readonly code: "RUNTIME_MODULE_LOAD_FAILED";
      readonly message: string;
      readonly filePath: string;
      readonly astPath: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: "ARTIFACT_REGISTRATION_FAILED";
      readonly message: string;
      readonly elementId: string;
      readonly reason: string;
    }
  | {
      readonly code: "ELEMENT_EVALUATION_FAILED";
      readonly message: string;
      readonly modulePath: string;
      readonly astPath: string;
      readonly cause?: unknown;
    }
  // Internal invariant
  | {
      readonly code: "INTERNAL_INVARIANT";
      readonly message: string;
      readonly context?: string;
      readonly cause?: unknown;
    }
  // Schema validation
  | {
      readonly code: "SCHEMA_NOT_FOUND";
      readonly message: string;
      readonly schemaLabel: string;
      readonly canonicalId: string;
    };

/**
 * Helper type for Builder operation results.
 */
export type BuilderResult<T> = Result<T, BuilderError>;

/**
 * Error constructor helpers for concise error creation.
 */
export const builderErrors = {
  entryNotFound: (entry: string, message?: string): BuilderError => ({
    code: "ENTRY_NOT_FOUND",
    message: message ?? `Entry not found: ${entry}`,
    entry,
  }),

  configNotFound: (path: string, message?: string): BuilderError => ({
    code: "CONFIG_NOT_FOUND",
    message: message ?? `Config file not found: ${path}`,
    path,
  }),

  configInvalid: (path: string, message: string, cause?: unknown): BuilderError => ({
    code: "CONFIG_INVALID",
    message,
    path,
    cause,
  }),

  discoveryIOError: (path: string, message: string, errno?: string | number, cause?: unknown): BuilderError => ({
    code: "DISCOVERY_IO_ERROR",
    message,
    path,
    errno,
    cause,
  }),

  fingerprintFailed: (filePath: string, message: string, cause?: unknown): BuilderError => ({
    code: "FINGERPRINT_FAILED",
    message,
    filePath,
    cause,
  }),

  unsupportedAnalyzer: (analyzer: string, message?: string): BuilderError => ({
    code: "UNSUPPORTED_ANALYZER",
    message: message ?? `Unsupported analyzer: ${analyzer}`,
    analyzer,
  }),

  canonicalPathInvalid: (path: string, reason?: string): BuilderError => ({
    code: "CANONICAL_PATH_INVALID",
    message: `Invalid canonical path: ${path}${reason ? ` (${reason})` : ""}`,
    path,
    reason,
  }),

  canonicalScopeMismatch: (expected: string, actual: string): BuilderError => ({
    code: "CANONICAL_SCOPE_MISMATCH",
    message: `Scope mismatch: expected ${expected}, got ${actual}`,
    expected,
    actual,
  }),

  graphCircularDependency: (chain: readonly string[]): BuilderError => ({
    code: "GRAPH_CIRCULAR_DEPENDENCY",
    message: `Circular dependency detected: ${chain.join(" → ")}`,
    chain,
  }),

  graphMissingImport: (importer: string, importee: string): BuilderError => ({
    code: "GRAPH_MISSING_IMPORT",
    message: `Missing import: "${importer}" imports "${importee}" but it's not in the graph`,
    importer,
    importee,
  }),

  docDuplicate: (name: string, sources: readonly string[]): BuilderError => ({
    code: "DOC_DUPLICATE",
    message: `Duplicate document name: ${name} found in ${sources.length} files`,
    name,
    sources,
  }),

  writeFailed: (outPath: string, message: string, cause?: unknown): BuilderError => ({
    code: "WRITE_FAILED",
    message,
    outPath,
    cause,
  }),

  cacheCorrupted: (message: string, cachePath?: string, cause?: unknown): BuilderError => ({
    code: "CACHE_CORRUPTED",
    message,
    cachePath,
    cause,
  }),

  runtimeModuleLoadFailed: (filePath: string, astPath: string, message: string, cause?: unknown): BuilderError => ({
    code: "RUNTIME_MODULE_LOAD_FAILED",
    message,
    filePath,
    astPath,
    cause,
  }),

  artifactRegistrationFailed: (elementId: string, reason: string): BuilderError => ({
    code: "ARTIFACT_REGISTRATION_FAILED",
    message: `Failed to register artifact element ${elementId}: ${reason}`,
    elementId,
    reason,
  }),

  elementEvaluationFailed: (modulePath: string, astPath: string, message: string, cause?: unknown): BuilderError => ({
    code: "ELEMENT_EVALUATION_FAILED",
    message,
    modulePath,
    astPath,
    cause,
  }),

  internalInvariant: (message: string, context?: string, cause?: unknown): BuilderError => ({
    code: "INTERNAL_INVARIANT",
    message: `Internal invariant violated: ${message}`,
    context,
    cause,
  }),

  schemaNotFound: (schemaLabel: string, canonicalId: string): BuilderError => ({
    code: "SCHEMA_NOT_FOUND",
    message: `Schema not found for label "${schemaLabel}" (element: ${canonicalId})`,
    schemaLabel,
    canonicalId,
  }),
} as const;

/**
 * Convenience helper to create an err Result from BuilderError.
 */
export const builderErr = <T = never>(error: BuilderError): BuilderResult<T> => err(error);

/**
 * Type guard for BuilderError.
 */
export const isBuilderError = (error: unknown): error is BuilderError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
};

/**
 * Format BuilderError for console output (human-readable).
 */
export const formatBuilderError = (error: BuilderError): string => {
  const lines: string[] = [];

  lines.push(`Error [${error.code}]: ${error.message}`);

  // Add context-specific details
  switch (error.code) {
    case "ENTRY_NOT_FOUND":
      lines.push(`  Entry: ${error.entry}`);
      break;
    case "CONFIG_NOT_FOUND":
    case "CONFIG_INVALID":
      lines.push(`  Path: ${error.path}`);
      if (error.code === "CONFIG_INVALID" && error.cause) {
        lines.push(`  Cause: ${error.cause}`);
      }
      break;
    case "DISCOVERY_IO_ERROR":
      lines.push(`  Path: ${error.path}`);
      if (error.errno !== undefined) {
        lines.push(`  Errno: ${error.errno}`);
      }
      break;
    case "FINGERPRINT_FAILED":
      lines.push(`  File: ${error.filePath}`);
      break;
    case "CANONICAL_PATH_INVALID":
      lines.push(`  Path: ${error.path}`);
      if (error.reason) {
        lines.push(`  Reason: ${error.reason}`);
      }
      break;
    case "CANONICAL_SCOPE_MISMATCH":
      lines.push(`  Expected: ${error.expected}`);
      lines.push(`  Actual: ${error.actual}`);
      break;
    case "GRAPH_CIRCULAR_DEPENDENCY":
      lines.push(`  Chain: ${error.chain.join(" → ")}`);
      break;
    case "GRAPH_MISSING_IMPORT":
      lines.push(`  Importer: ${error.importer}`);
      lines.push(`  Importee: ${error.importee}`);
      break;
    case "DOC_DUPLICATE":
      lines.push(`  Name: ${error.name}`);
      lines.push(`  Sources:\n    ${error.sources.join("\n    ")}`);
      break;
    case "WRITE_FAILED":
      lines.push(`  Output path: ${error.outPath}`);
      break;
    case "CACHE_CORRUPTED":
      if (error.cachePath) {
        lines.push(`  Cache path: ${error.cachePath}`);
      }
      break;
    case "RUNTIME_MODULE_LOAD_FAILED":
      lines.push(`  File: ${error.filePath}`);
      lines.push(`  AST path: ${error.astPath}`);
      break;
    case "ARTIFACT_REGISTRATION_FAILED":
      lines.push(`  Element ID: ${error.elementId}`);
      lines.push(`  Reason: ${error.reason}`);
      break;
    case "ELEMENT_EVALUATION_FAILED":
      lines.push(`  at ${error.modulePath}`);
      if (error.astPath) {
        lines.push(`  in ${error.astPath}`);
      }
      break;
    case "INTERNAL_INVARIANT":
      if (error.context) {
        lines.push(`  Context: ${error.context}`);
      }
      break;
    case "SCHEMA_NOT_FOUND":
      lines.push(`  Schema label: ${error.schemaLabel}`);
      lines.push(`  Element: ${error.canonicalId}`);
      break;
  }

  // Add cause if present and not already shown
  if ("cause" in error && error.cause && !["CONFIG_INVALID"].includes(error.code)) {
    lines.push(`  Caused by: ${error.cause}`);
  }

  return lines.join("\n");
};

/**
 * Assert unreachable code path (for exhaustiveness checks).
 * This is the ONLY acceptable throw in builder code.
 */
export const assertUnreachable = (value: never, context?: string): never => {
  throw new Error(`Unreachable code path${context ? ` in ${context}` : ""}: received ${JSON.stringify(value)}`);
};
