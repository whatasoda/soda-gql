/**
 * Core type definitions for @soda-gql/core
 * All types are re-exported from this index for convenience
 */

// Brand function utility
export { hiddenBrand } from "./brand-func";

// Field selection types
export type {
  ConditionalField,
  DeepFieldSelection,
  ExtractNonRelations,
  ExtractRelations,
  FieldSelection,
  PartialFields,
  RecursiveFieldSelection,
  RequiredFields,
  SelectedFields,
} from "./field-selection";
// Mutation slice types
export type { MutationSlice } from "./mutation-slice";
// Page query types
export type { PageQuery } from "./page-query";
// Query slice types
export type { QuerySlice, SelectionBuilder } from "./query-slice";
// Remote model types (FieldSelection now exported from field-selection)
export type { RemoteModel, TransformFunction } from "./remote-model";

import type { MutationSlice } from "./mutation-slice";
import type { PageQuery } from "./page-query";
import type { QuerySlice } from "./query-slice";
// Import types for aliases
import type { RemoteModel } from "./remote-model";

// Common type aliases for convenience
export type AnyRemoteModel = RemoteModel<any, any, any>;
export type AnyQuerySlice = QuerySlice<any, any>;
export type AnyMutationSlice = MutationSlice<any, any>;
export type AnyPageQuery = PageQuery<any, any>;

// Utility types for type inference
export type InferModelType<T> = T extends RemoteModel<infer U, any, any> ? U : never;
export type InferModelTransformed<T> = T extends RemoteModel<any, infer U, any> ? U : never;
export type InferModelParams<T> = T extends RemoteModel<any, any, infer U> ? U : never;

export type InferSliceData<T> = T extends QuerySlice<infer U, any>
  ? U
  : T extends MutationSlice<infer U, any>
    ? U
    : never;

export type InferSliceArgs<T> = T extends QuerySlice<any, infer U>
  ? U
  : T extends MutationSlice<any, infer U>
    ? U
    : never;

export type InferPageData<T> = T extends PageQuery<infer U, any> ? U : never;
export type InferPageVariables<T> = T extends PageQuery<any, infer U> ? U : never;
