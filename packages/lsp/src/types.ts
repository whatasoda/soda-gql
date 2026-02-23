/**
 * Core type definitions for the LSP server.
 * @module
 */

import type { FragmentDefinitionNode } from "graphql";

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
  /** Element name from curried tag call (e.g., "GetUser" from query("GetUser")). */
  readonly elementName?: string;
  /** Type name from curried fragment call (e.g., "User" from fragment("UserFields", "User")). */
  readonly typeName?: string;
};

/** Per-document state maintained by the document manager. */
export type DocumentState = {
  readonly uri: string;
  readonly version: number;
  readonly source: string;
  readonly templates: readonly ExtractedTemplate[];
};

/** A fragment definition indexed from a workspace document. */
export type IndexedFragment = {
  readonly uri: string;
  readonly schemaName: string;
  readonly fragmentName: string;
  readonly definition: FragmentDefinitionNode;
  readonly content: string;
  readonly contentRange: { readonly start: number; readonly end: number };
  readonly tsSource: string;
};

/** A located fragment spread reference within a template. */
export type FragmentSpreadLocation = {
  readonly uri: string;
  readonly tsSource: string;
  readonly template: ExtractedTemplate;
  /** Offset of the fragment name (after "...") within GraphQL content. */
  readonly nameOffset: number;
  readonly nameLength: number;
};
