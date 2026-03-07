/**
 * Shared types for tagged template extraction and formatting.
 * @module
 */

/** Operation kind extracted from tagged template tag name. */
export type OperationKind = "query" | "mutation" | "subscription" | "fragment";

/** A single tagged template extracted from a TypeScript source file. */
export type ExtractedTemplate = {
  /** Resolved schema name from gql.{schemaName}. */
  readonly schemaName: string;
  /** Operation kind from tag name. */
  readonly kind: OperationKind;
  /** Raw GraphQL content between backticks (may contain __FRAG_SPREAD_N__ placeholders). */
  readonly content: string;
  /** Element name from curried tag call (e.g., "GetUser" from query("GetUser")). */
  readonly elementName?: string;
  /** Type name from curried fragment call (e.g., "User" from fragment("UserFields", "User")). */
  readonly typeName?: string;
  /** Character offset range of GraphQL content within TS source (excludes backticks). */
  readonly contentRange?: { readonly start: number; readonly end: number };
  /** Character offset ranges of interpolation expressions within TS source (for __FRAG_SPREAD_N__ restoration). */
  readonly expressionRanges?: readonly { readonly start: number; readonly end: number }[];
};

/** ExtractedTemplate with guaranteed position information (when positionCtx is provided). */
export type ExtractedTemplateWithPosition = ExtractedTemplate & {
  readonly contentRange: { readonly start: number; readonly end: number };
};

/** A text edit to apply to source code for template formatting. */
export type TemplateFormatEdit = {
  readonly start: number;
  readonly end: number;
  readonly newText: string;
};
