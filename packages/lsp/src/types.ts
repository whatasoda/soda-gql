/**
 * Core type definitions for the LSP server.
 * @module
 */

import type { ExtractedTemplateWithPosition, OperationKind } from "@soda-gql/common/template-extraction";
import type { FragmentDefinitionNode } from "graphql";

export type { OperationKind };

/** A single tagged template extracted from a TypeScript file (with guaranteed position info). */
export type ExtractedTemplate = ExtractedTemplateWithPosition;

/** Per-document state maintained by the document manager. */
export type DocumentState = {
  readonly uri: string;
  readonly version: number;
  readonly source: string;
  readonly templates: readonly ExtractedTemplate[];
  /** Set when @swc/core could not be loaded; template extraction is skipped. */
  readonly swcUnavailable?: true;
};

/** A fragment definition indexed from a workspace document. */
export type IndexedFragment = {
  readonly uri: string;
  readonly schemaName: string;
  readonly fragmentName: string;
  readonly definition: FragmentDefinitionNode;
  /** Reconstructed full GraphQL source (with definition header for curried syntax). */
  readonly content: string;
  readonly contentRange: { readonly start: number; readonly end: number };
  readonly tsSource: string;
  /** Number of bytes prepended by reconstruction. */
  readonly headerLen: number;
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
