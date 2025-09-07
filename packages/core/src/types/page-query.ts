/**
 * Page Query type definitions
 * Copied from spec - not imported from /specs directory
 */

import type { MutationSlice } from "./mutation-slice";
import type { QuerySlice } from "./query-slice";

/**
 * Transform function for normalizing data
 */
export type TransformFunction<TInput = any, TOutput = any> = (data: TInput) => TOutput;

/**
 * Page Query definition
 * Represents a complete GraphQL operation (query, mutation, or subscription)
 */
export interface PageQuery<TData = any, TVariables = any> {
  /**
   * Internal type brands for type inference
   */
  readonly _data: () => TData;
  readonly _variables: () => TVariables;

  /**
   * Query/Mutation/Subscription name
   */
  name: string;

  /**
   * Operation type
   */
  type: "query" | "mutation" | "subscription";

  /**
   * Slices that compose this page query
   */
  slices: Array<QuerySlice<any, any> | MutationSlice<any, any>>;

  /**
   * Generated GraphQL document (populated at build time)
   */
  document: string;

  /**
   * Variables for the operation
   */
  variables: TVariables;
}

export type { MutationSlice } from "./mutation-slice";
// Re-export dependent types for convenience
export type { QuerySlice } from "./query-slice";
