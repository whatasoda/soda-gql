import type { Fragment, GqlElementAttachment } from "@soda-gql/core";
import { Projection } from "./projection";
import type { SlicedExecutionResult } from "./sliced-execution-result";
import type { Tuple } from "./utils/type-utils";

// biome-ignore lint/suspicious/noExplicitAny: Type alias for any Fragment regardless of type parameters
type AnyFragment = Fragment<string, any, any, any>;

/**
 * Options for creating a projection from a Fragment.
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
   * Receives a SlicedExecutionResult with the Fragment's output type.
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
 * Creates a type-safe projection from a Fragment.
 *
 * The projection extracts and transforms data from GraphQL execution results,
 * with full type inference from the Fragment's output type.
 *
 * Note: The Fragment parameter is used only for type inference.
 * The actual paths must be specified explicitly.
 *
 * @param _fragment - The Fragment to infer types from (used for type inference only)
 * @param options - Projection options including paths and handle function
 * @returns A Projection that can be used with createExecutionResultParser
 *
 * @example
 * ```typescript
 * const userFragment = gql(({ fragment }) =>
 *   fragment.Query({ variables: [...] }, ({ f, $ }) => [
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
export const createProjection = <TFragment extends AnyFragment, TProjected>(
  _fragment: TFragment,
  options: CreateProjectionOptions<TFragment["$infer"]["output"], TProjected>,
): Projection<TProjected> => {
  return new Projection(options.paths, options.handle);
};

export const createProjectionAttachment = <TFragment extends AnyFragment, TProjected>(
  options: CreateProjectionOptions<NoInfer<TFragment>["$infer"]["output"], TProjected>,
): GqlElementAttachment<TFragment, "projection", Projection<TProjected>> => {
  return {
    name: "projection",
    createValue: (fragment) => createProjection(fragment, options),
  };
};
