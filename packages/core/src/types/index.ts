/**
 * Core type definitions for @soda-gql/core
 * All types are re-exported from this index for convenience
 */

// Brand function utility
export { hiddenBrand } from "./brand-func";

// Field selection types
export type {
  ConditionalField,
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
export type {
  FieldSelector,
  RelationFunction,
  RemoteModel,
  TransformFunction,
} from "./remote-model";

import type { MutationSlice } from "./mutation-slice";
import type { PageQuery } from "./page-query";
import type { QuerySlice } from "./query-slice";
// Import types for aliases
import type { RemoteModel } from "./remote-model";

// Common type aliases for convenience
// biome-ignore lint/suspicious/noExplicitAny: utility type aliases for any model/slice types
export type AnyRemoteModel = RemoteModel<any, any, any>;
// biome-ignore lint/suspicious/noExplicitAny: utility type alias
export type AnyQuerySlice = QuerySlice<any, any>;
// biome-ignore lint/suspicious/noExplicitAny: utility type alias
export type AnyMutationSlice = MutationSlice<any, any>;
// biome-ignore lint/suspicious/noExplicitAny: utility type alias
export type AnyPageQuery = PageQuery<any, any>;

// Utility types for type inference
// biome-ignore lint/suspicious/noExplicitAny: type inference utility
export type InferModelType<T> = T extends RemoteModel<infer U, any, any> ? U : never;
// biome-ignore lint/suspicious/noExplicitAny: type inference utility
export type InferModelTransformed<T> = T extends RemoteModel<any, infer U, any> ? U : never;
// biome-ignore lint/suspicious/noExplicitAny: type inference utility
export type InferModelParams<T> = T extends RemoteModel<any, any, infer U> ? U : never;

export type InferSliceData<T> =
  // biome-ignore lint/suspicious/noExplicitAny: type inference utility
  T extends QuerySlice<infer U, any>
    ? U
    : // biome-ignore lint/suspicious/noExplicitAny: type inference utility
      T extends MutationSlice<infer U, any>
      ? U
      : never;

export type InferSliceArgs<T> =
  // biome-ignore lint/suspicious/noExplicitAny: type inference utility
  T extends QuerySlice<any, infer U>
    ? U
    : // biome-ignore lint/suspicious/noExplicitAny: type inference utility
      T extends MutationSlice<any, infer U>
      ? U
      : never;

// biome-ignore lint/suspicious/noExplicitAny: type inference utility
export type InferPageData<T> = T extends PageQuery<infer U, any> ? U : never;
// biome-ignore lint/suspicious/noExplicitAny: type inference utility
export type InferPageVariables<T> = T extends PageQuery<any, infer U> ? U : never;
