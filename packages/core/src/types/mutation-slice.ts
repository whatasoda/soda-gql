/**
 * Mutation Slice type definitions
 * Copied from spec - not imported from /specs directory
 */

/**
 * Transform function for normalizing data
 */
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
  relation: (field: string, model: any) => any;

  /**
   * Add an argument
   */
  argument: (name: string, value: any) => { name: string; value: any };
}

/**
 * Mutation Slice definition
 * Represents a reusable mutation fragment that can be composed into page mutations
 */
export interface MutationSlice<TData = any, TArgs = any> {
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
   * Mutation name
   */
  name: string;

  /**
   * Selection function that builds the mutation
   */
  selections: (mutate: SelectionBuilder, args: TArgs) => TData;

  /**
   * Transform function for the response data
   */
  transform: TransformFunction<any, TData>;
}
