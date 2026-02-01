/**
 * Core type definitions for the LSP server.
 * @module
 */

/** Operation kind extracted from tagged template tag name. */
export type OperationKind = "query" | "mutation" | "subscription" | "fragment";

/** A single tagged template extracted from a TypeScript file. */
export type ExtractedTemplate = {
  /** Byte offset range of GraphQL content within TS source (excludes backticks). */
  readonly contentRange: { readonly start: number; readonly end: number };
  /** Resolved schema name from gql.{schemaName}. */
  readonly schemaName: string;
  /** Operation kind from tag name. */
  readonly kind: OperationKind;
  /** Raw GraphQL content between backticks. */
  readonly content: string;
};

/** Per-document state maintained by the document manager. */
export type DocumentState = {
  readonly uri: string;
  readonly version: number;
  readonly source: string;
  readonly templates: readonly ExtractedTemplate[];
};
