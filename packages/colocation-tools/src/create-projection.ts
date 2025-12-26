import type { Model } from "@soda-gql/core";
import { Projection } from "./projection";
import type { SlicedExecutionResult } from "./sliced-execution-result";
import type { Tuple } from "./utils/type-utils";

type AnyModel = Model<string, any, any, any>;

/**
 * Options for creating a projection from a Model.
 */
export type CreateProjectionOptions<TOutput extends object, TProjected> = {
  /**
   * Field paths to extract from the execution result.
   * Each path starts with "$." and follows the field selection structure.
   *
   * @example
   * ```typescript
   * paths: ["$.user.id", "$.user.name"]
   * ```
   */
  paths: Tuple<string>;

  /**
   * Handler function to transform the sliced execution result.
   * Receives a SlicedExecutionResult with the Model's output type.
   * Handles all cases: success, error, and empty.
   *
   * @example
   * ```typescript
   * handle: (result) => {
   *   if (result.isError()) return { error: result.error, data: null };
   *   if (result.isEmpty()) return { error: null, data: null };
   *   const data = result.unwrap();
   *   return { error: null, data: { userId: data.user.id } };
   * }
   * ```
   */
  handle: (result: SlicedExecutionResult<TOutput>) => TProjected;
};

/**
 * Creates a type-safe projection from a Model.
 *
 * The projection extracts and transforms data from GraphQL execution results,
 * with full type inference from the Model's output type.
 *
 * Note: The Model parameter is used only for type inference.
 * The actual paths must be specified explicitly.
 *
 * @param _model - The Model to infer types from (used for type inference only)
 * @param options - Projection options including paths and handle function
 * @returns A Projection that can be used with createExecutionResultParser
 *
 * @example
 * ```typescript
 * const userFragment = gql(({ model }) =>
 *   model.Query({ variables: [...] }, ({ f, $ }) => [
 *     f.user({ id: $.userId })(({ f }) => [f.id(), f.name()]),
 *   ])
 * );
 *
 * const userProjection = createProjection(userFragment, {
 *   paths: ["$.user"],
 *   handle: (result) => {
 *     if (result.isError()) return { error: result.error, user: null };
 *     if (result.isEmpty()) return { error: null, user: null };
 *     const data = result.unwrap();
 *     return { error: null, user: data.user };
 *   },
 * });
 * ```
 */
export const createProjection = <TModel extends AnyModel, TProjected>(
  _model: TModel,
  options: CreateProjectionOptions<TModel["$infer"]["output"], TProjected>,
): Projection<TProjected> => {
  return new Projection(options.paths, options.handle);
};
