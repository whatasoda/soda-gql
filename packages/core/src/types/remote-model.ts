/**
 * Remote Model type definitions
 * Copied from spec - not imported from /specs directory
 */

import type { FieldSelection } from "./field-selection";

/**
 * Transform function for normalizing data
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for transform function
export type TransformFunction<TInput = any, TOutput = any> = (data: TInput) => TOutput;

/**
 * Relation function for building nested selections
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for relation function
export type RelationFunction<T = any> = <R>(
  field: keyof T,
  // biome-ignore lint/suspicious/noExplicitAny: model can have any transform and params
  model: RemoteModel<R, any, any>,
) => FieldSelection<R>;

/**
 * Field selector function that builds field selection
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for selector function
export type FieldSelector<TType = any, TParams = {}> = (
  relation: RelationFunction<TType>,
  args?: TParams,
) => FieldSelection<TType>;

/**
 * Remote Model definition
 * Represents a reusable GraphQL fragment with transformation
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for model interface
export interface RemoteModel<TType = any, TTransformed = any, TParams = {}> {
  /**
   * Internal type brands for type inference
   */
  readonly _type: () => TType;
  readonly _transformed: () => TTransformed;
  readonly _params: () => TParams;

  /**
   * GraphQL type name
   */
  typeName: string;

  /**
   * Field selector function with context-aware relations
   */
  fields: FieldSelector<TType, TParams>;

  /**
   * Transform function
   */
  transform: TransformFunction<TType, TTransformed>;

  /**
   * Optional parameters for this model
   */
  parameters?: TParams;
}
