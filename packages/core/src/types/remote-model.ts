/**
 * Remote Model type definitions
 * Copied from spec - not imported from /specs directory
 */

import type { FieldSelection } from "./field-selection";

/**
 * Transform function for normalizing data
 */
export type TransformFunction<TInput = any, TOutput = any> = (data: TInput) => TOutput;

/**
 * Remote Model definition
 * Represents a reusable GraphQL fragment with transformation
 */
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
   * Field selection
   */
  fields: FieldSelection<TType>;

  /**
   * Transform function
   */
  transform: TransformFunction<TType, TTransformed>;

  /**
   * Optional parameters for this model
   */
  parameters?: TParams;
}
