// @soda-gql/lsp - GraphQL LSP server for soda-gql

export type { DocumentManager } from "./document-manager";
export { createDocumentManager } from "./document-manager";
export type { LspError, LspErrorCode, LspResult } from "./errors";
export { lspErrors } from "./errors";
export { preprocessFragmentArgs } from "./fragment-args-preprocessor";
export type { PositionMapper } from "./position-mapping";
export { createPositionMapper } from "./position-mapping";
export type { SchemaEntry, SchemaResolver } from "./schema-resolver";
export { createSchemaResolver } from "./schema-resolver";
export type { LspServerOptions } from "./server";
export { createLspServer } from "./server";
export type { DocumentState, ExtractedTemplate, FragmentSpreadLocation, IndexedFragment, OperationKind } from "./types";
