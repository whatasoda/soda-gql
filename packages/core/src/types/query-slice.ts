/**
 * Query Slice type definitions
 * Copied from spec - not imported from /specs directory
 */

/**
 * Transform function for normalizing data
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for transform function
export type TransformFunction<TInput = any, TOutput = any> = (data: TInput) => TOutput;

/**
 * Selection builder for constructing GraphQL selections
 */
export interface SelectionBuilder {
  /**
   * Select a field
   */
  select: (field: string) => boolean;

  /**
   * Select a relation with a model
   */
  // biome-ignore lint/suspicious/noExplicitAny: model can be any type
  relation: (field: string, model: any) => any;

  /**
   * Add an argument
   */
  // biome-ignore lint/suspicious/noExplicitAny: arguments can be any type
  argument: (name: string, value: any) => { name: string; value: any };
}

/**
 * Query Slice definition
 * Represents a reusable query fragment that can be composed into page queries
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for slice interface
export interface QuerySlice<TData = any, TArgs = any> {
  /**
   * Internal type brands for type inference
   */
  readonly _data: () => TData;
  readonly _args: () => TArgs;

  /**
   * Unique key for this slice
   */
  sliceKey: string;

  /**
   * Query name
   */
  name: string;

  /**
   * Selection function that builds the query
   */
  selections: (query: SelectionBuilder, args: TArgs) => TData;

  /**
   * Transform function for the response data
   */
  // biome-ignore lint/suspicious/noExplicitAny: transform input can be any type
  transform: TransformFunction<any, TData>;
}
