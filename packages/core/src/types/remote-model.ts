/**
 * Remote Model type definitions
 * Copied from spec - not imported from /specs directory
 */

import type { FieldSelection } from "./field-selection";
import type { Hidden } from "./hidden";

/**
 * Transform function for normalizing data
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for transform function
export type TransformFunction<TInput = any, TOutput = any> = (data: TInput) => TOutput;

/**
 * Field selector context providing field methods
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for field context
export interface FieldSelectorContext<TType = any> {
  fields: TType;
  // biome-ignore lint/suspicious/noExplicitAny: args can be any type
  args: any;
}

/**
 * Field selector function that builds field selection
 */
// biome-ignore lint/suspicious/noExplicitAny: generic defaults for selector function
export type FieldSelector<TType = any, _TParams = {}> = (
  context: FieldSelectorContext<TType>,
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
  readonly _type: Hidden<() => TType>;
  readonly _transformed: Hidden<() => TTransformed>;
  readonly _params: Hidden<() => TParams>;

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
