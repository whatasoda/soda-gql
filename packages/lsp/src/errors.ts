/**
 * Structured error types for the LSP server.
 * @module
 */

import type { Result } from "neverthrow";

/** Error code taxonomy for LSP operations. */
export type LspErrorCode =
  | "CONFIG_LOAD_FAILED"
  | "SCHEMA_LOAD_FAILED"
  | "SCHEMA_BUILD_FAILED"
  | "SCHEMA_NOT_CONFIGURED"
  | "PARSE_FAILED"
  | "INTERNAL_INVARIANT";

type ConfigLoadFailed = { readonly code: "CONFIG_LOAD_FAILED"; readonly message: string; readonly cause?: unknown };
type SchemaLoadFailed = {
  readonly code: "SCHEMA_LOAD_FAILED";
  readonly message: string;
  readonly schemaName: string;
  readonly cause?: unknown;
};
type SchemaBuildFailed = {
  readonly code: "SCHEMA_BUILD_FAILED";
  readonly message: string;
  readonly schemaName: string;
  readonly cause?: unknown;
};
type SchemaNotConfigured = { readonly code: "SCHEMA_NOT_CONFIGURED"; readonly message: string; readonly schemaName: string };
type ParseFailed = { readonly code: "PARSE_FAILED"; readonly message: string; readonly uri: string; readonly cause?: unknown };
type InternalInvariant = {
  readonly code: "INTERNAL_INVARIANT";
  readonly message: string;
  readonly context?: string;
  readonly cause?: unknown;
};

/** Structured error type for all LSP operations. */
export type LspError =
  | ConfigLoadFailed
  | SchemaLoadFailed
  | SchemaBuildFailed
  | SchemaNotConfigured
  | ParseFailed
  | InternalInvariant;

/** Helper type for LSP operation results. */
export type LspResult<T> = Result<T, LspError>;

/** Error constructor helpers for concise error creation. */
export const lspErrors = {
  configLoadFailed: (message: string, cause?: unknown): ConfigLoadFailed => ({
    code: "CONFIG_LOAD_FAILED",
    message,
    cause,
  }),

  schemaLoadFailed: (schemaName: string, message?: string, cause?: unknown): SchemaLoadFailed => ({
    code: "SCHEMA_LOAD_FAILED",
    message: message ?? `Failed to load schema: ${schemaName}`,
    schemaName,
    cause,
  }),

  schemaBuildFailed: (schemaName: string, message?: string, cause?: unknown): SchemaBuildFailed => ({
    code: "SCHEMA_BUILD_FAILED",
    message: message ?? `Failed to build schema: ${schemaName}`,
    schemaName,
    cause,
  }),

  schemaNotConfigured: (schemaName: string): SchemaNotConfigured => ({
    code: "SCHEMA_NOT_CONFIGURED",
    message: `Schema "${schemaName}" is not configured in soda-gql.config`,
    schemaName,
  }),

  parseFailed: (uri: string, message?: string, cause?: unknown): ParseFailed => ({
    code: "PARSE_FAILED",
    message: message ?? `Failed to parse: ${uri}`,
    uri,
    cause,
  }),

  internalInvariant: (message: string, context?: string, cause?: unknown): InternalInvariant => ({
    code: "INTERNAL_INVARIANT",
    message,
    context,
    cause,
  }),
} as const;
