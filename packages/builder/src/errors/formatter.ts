import type { BuilderError, BuilderErrorCode } from "../errors";

/**
 * Hints for each error code to help users understand and fix issues.
 */
const errorHints: Partial<Record<BuilderErrorCode, string>> = {
  ELEMENT_EVALUATION_FAILED:
    "Check if all imported fragments are properly exported and included in entry patterns.",
  GRAPH_CIRCULAR_DEPENDENCY: "Break the circular import by extracting shared types to a common module.",
  GRAPH_MISSING_IMPORT: "Verify the import path exists and the module is included in entry patterns.",
  RUNTIME_MODULE_LOAD_FAILED: "Ensure the module can be imported and all dependencies are installed.",
  CONFIG_NOT_FOUND: "Create a soda-gql.config.ts file in your project root.",
  CONFIG_INVALID: "Check your configuration file for syntax errors or invalid options.",
  ENTRY_NOT_FOUND: "Verify the entry pattern matches your file structure.",
  INTERNAL_INVARIANT: "This is an internal error. Please report it at https://github.com/soda-gql/soda-gql/issues",
};

/**
 * Formatted error with structured information for display.
 */
export type FormattedError = {
  readonly code: BuilderErrorCode;
  readonly message: string;
  readonly location?: {
    readonly modulePath: string;
    readonly astPath?: string;
  };
  readonly hint?: string;
  readonly relatedFiles?: readonly string[];
  readonly cause?: unknown;
};

/**
 * Format a BuilderError into a structured FormattedError object.
 */
export const formatBuilderErrorStructured = (error: BuilderError): FormattedError => {
  const base: FormattedError = {
    code: error.code,
    message: error.message,
    hint: errorHints[error.code],
    cause: "cause" in error ? error.cause : undefined,
  };

  switch (error.code) {
    case "ELEMENT_EVALUATION_FAILED":
      return {
        ...base,
        location: {
          modulePath: error.modulePath,
          astPath: error.astPath || undefined,
        },
      };

    case "RUNTIME_MODULE_LOAD_FAILED":
      return {
        ...base,
        location: {
          modulePath: error.filePath,
          astPath: error.astPath,
        },
      };

    case "GRAPH_MISSING_IMPORT":
      return {
        ...base,
        relatedFiles: [error.importer, error.importee],
      };

    case "GRAPH_CIRCULAR_DEPENDENCY":
      return {
        ...base,
        relatedFiles: error.chain,
      };

    case "CONFIG_NOT_FOUND":
    case "CONFIG_INVALID":
      return {
        ...base,
        location: {
          modulePath: error.path,
        },
      };

    case "FINGERPRINT_FAILED":
      return {
        ...base,
        location: {
          modulePath: error.filePath,
        },
      };

    case "DISCOVERY_IO_ERROR":
      return {
        ...base,
        location: {
          modulePath: error.path,
        },
      };

    default:
      return base;
  }
};

/**
 * Format a BuilderError for CLI/stderr output with human-readable formatting.
 * Includes location, hint, and related files when available.
 */
export const formatBuilderErrorForCLI = (error: BuilderError): string => {
  const formatted = formatBuilderErrorStructured(error);
  const lines: string[] = [];

  // Header with error code and message
  lines.push(`Error [${formatted.code}]: ${formatted.message}`);

  // Location information
  if (formatted.location) {
    lines.push(`  at ${formatted.location.modulePath}`);
    if (formatted.location.astPath) {
      lines.push(`  in ${formatted.location.astPath}`);
    }
  }

  // Hint for fixing the issue
  if (formatted.hint) {
    lines.push("");
    lines.push(`  Hint: ${formatted.hint}`);
  }

  // Related files (for dependency errors)
  if (formatted.relatedFiles && formatted.relatedFiles.length > 0) {
    lines.push("");
    lines.push("  Related files:");
    for (const file of formatted.relatedFiles) {
      lines.push(`    - ${file}`);
    }
  }

  return lines.join("\n");
};
