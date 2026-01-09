/**
 * Error types for typegen package.
 *
 * @module
 */

import type { BuilderError } from "@soda-gql/builder";

/**
 * Error codes specific to typegen operations.
 */
export type TypegenErrorCode =
  | "TYPEGEN_CODEGEN_REQUIRED"
  | "TYPEGEN_SCHEMA_LOAD_FAILED"
  | "TYPEGEN_BUILD_FAILED"
  | "TYPEGEN_EMIT_FAILED"
  | "TYPEGEN_BUNDLE_FAILED"
  | "TYPEGEN_FRAGMENT_MISSING_KEY";

/**
 * Typegen-specific error type.
 */
export type TypegenSpecificError =
  | {
      readonly code: "TYPEGEN_CODEGEN_REQUIRED";
      readonly message: string;
      readonly outdir: string;
    }
  | {
      readonly code: "TYPEGEN_SCHEMA_LOAD_FAILED";
      readonly message: string;
      readonly schemaNames: readonly string[];
      readonly cause?: unknown;
    }
  | {
      readonly code: "TYPEGEN_BUILD_FAILED";
      readonly message: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: "TYPEGEN_EMIT_FAILED";
      readonly message: string;
      readonly path: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: "TYPEGEN_BUNDLE_FAILED";
      readonly message: string;
      readonly path: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: "TYPEGEN_FRAGMENT_MISSING_KEY";
      readonly message: string;
      readonly fragments: readonly {
        readonly canonicalId: string;
        readonly typename: string;
        readonly schemaLabel: string;
      }[];
    };

/**
 * Union of all typegen errors (specific + builder errors).
 */
export type TypegenError = TypegenSpecificError | BuilderError;

/**
 * Error constructor helpers for concise error creation.
 */
export const typegenErrors = {
  codegenRequired: (outdir: string): TypegenSpecificError => ({
    code: "TYPEGEN_CODEGEN_REQUIRED",
    message: `Generated graphql-system module not found at '${outdir}'. Run 'soda-gql codegen' first.`,
    outdir,
  }),

  schemaLoadFailed: (schemaNames: readonly string[], cause?: unknown): TypegenSpecificError => ({
    code: "TYPEGEN_SCHEMA_LOAD_FAILED",
    message: `Failed to load schemas: ${schemaNames.join(", ")}`,
    schemaNames,
    cause,
  }),

  buildFailed: (message: string, cause?: unknown): TypegenSpecificError => ({
    code: "TYPEGEN_BUILD_FAILED",
    message,
    cause,
  }),

  emitFailed: (path: string, message: string, cause?: unknown): TypegenSpecificError => ({
    code: "TYPEGEN_EMIT_FAILED",
    message,
    path,
    cause,
  }),

  bundleFailed: (path: string, message: string, cause?: unknown): TypegenSpecificError => ({
    code: "TYPEGEN_BUNDLE_FAILED",
    message,
    path,
    cause,
  }),

  fragmentMissingKey: (
    fragments: readonly { canonicalId: string; typename: string; schemaLabel: string }[],
  ): TypegenSpecificError => ({
    code: "TYPEGEN_FRAGMENT_MISSING_KEY",
    message: `${fragments.length} fragment(s) missing required 'key' property for prebuilt types`,
    fragments,
  }),
} as const;

/**
 * Format TypegenError for console output (human-readable).
 */
export const formatTypegenError = (error: TypegenError): string => {
  const lines: string[] = [];

  lines.push(`Error [${error.code}]: ${error.message}`);

  switch (error.code) {
    case "TYPEGEN_CODEGEN_REQUIRED":
      lines.push(`  Output directory: ${error.outdir}`);
      lines.push("  Hint: Run 'soda-gql codegen' to generate the graphql-system module first.");
      break;
    case "TYPEGEN_SCHEMA_LOAD_FAILED":
      lines.push(`  Schemas: ${error.schemaNames.join(", ")}`);
      break;
    case "TYPEGEN_EMIT_FAILED":
    case "TYPEGEN_BUNDLE_FAILED":
      lines.push(`  Path: ${error.path}`);
      break;
    case "TYPEGEN_FRAGMENT_MISSING_KEY":
      lines.push("  Fragments missing 'key' property:");
      for (const fragment of error.fragments) {
        lines.push(`    - ${fragment.canonicalId} (${fragment.typename} on ${fragment.schemaLabel})`);
      }
      lines.push("  Hint: Add a 'key' property to each fragment for prebuilt type resolution.");
      break;
  }

  if ("cause" in error && error.cause) {
    lines.push(`  Caused by: ${error.cause}`);
  }

  return lines.join("\n");
};
