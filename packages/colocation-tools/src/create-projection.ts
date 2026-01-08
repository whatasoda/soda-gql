import type { AnyFields, Fragment, GqlElementAttachment } from "@soda-gql/core";
import { Projection } from "./projection";
import type { SlicedExecutionResult } from "./sliced-execution-result";
import type { AvailableFieldPathOf } from "./types/field-path";
import type { InferPathsOutput } from "./types/output-path";
import type { Tuple } from "./utils/type-utils";

// biome-ignore lint/suspicious/noExplicitAny: Type alias for any Fragment regardless of type parameters
type AnyFragment = Fragment<string, any, any, any, string | undefined>;

/** Get TFields from Fragment via spread's return type. */
type FragmentFields<TFragment extends AnyFragment> = ReturnType<TFragment["spread"]>;

/**
 * Options for creating a projection from a Fragment.
 */
export type CreateProjectionOptions<
  TFields extends AnyFields,
  TOutput extends object,
  TPaths extends Tuple<AvailableFieldPathOf<TFields>>,
  TProjected,
> = {
  /**
   * Field paths to extract from the execution result.
   * Each path starts with "$." and follows the field selection structure.
   * Paths are type-checked against the Fragment's field structure.
   *
   * @example
   * ```typescript
   * paths: ["$.user.id", "$.user.name"]
   * ```
   */
  paths: TPaths;

  /**
   * Handler function to transform the sliced execution result.
   * Receives a SlicedExecutionResult with types inferred from the specified paths.
   * Handles all cases: success, error, and empty.
   *
   * @example
   * ```typescript
   * handle: (result) => {
   *   if (result.isError()) return { error: result.error, data: null };
   *   if (result.isEmpty()) return { error: null, data: null };
   *   const [id, name] = result.unwrap(); // tuple of types from paths
   *   return { error: null, data: { id, name } };
   * }
   * ```
   */
  handle: (result: SlicedExecutionResult<InferPathsOutput<TOutput, TPaths>>) => TProjected;
};

/**
 * Creates a type-safe projection from a Fragment.
 *
 * The projection extracts and transforms data from GraphQL execution results,
 * with full type inference from the Fragment's field structure and output type.
 *
 * - Paths are validated against Fragment's TFields via `ReturnType<Fragment["spread"]>`
 * - Handler receives types inferred from the specified paths
 *
 * @param _fragment - The Fragment to infer types from (used for type inference only)
 * @param options - Projection options including paths and handle function
 * @returns A Projection that can be used with createExecutionResultParser
 *
 * @example
 * ```typescript
 * const userFragment = gql(({ fragment }) =>
 *   fragment.Query({
 *     variables: { ... },
 *     fields: ({ f, $ }) => ({
 *       ...f.user({ id: $.userId })(({ f }) => ({ ...f.id(), ...f.name() })),
 *     }),
 *   })
 * );
 *
 * const userProjection = createProjection(userFragment, {
 *   paths: ["$.user.id", "$.user.name"],
 *   handle: (result) => {
 *     if (result.isError()) return { error: result.error, data: null };
 *     if (result.isEmpty()) return { error: null, data: null };
 *     const [id, name] = result.unwrap(); // tuple: [string, string]
 *     return { error: null, data: { id, name } };
 *   },
 * });
 * ```
 */
export const createProjection = <
  TFragment extends AnyFragment,
  const TPaths extends Tuple<AvailableFieldPathOf<FragmentFields<TFragment>>>,
  TProjected,
>(
  _fragment: TFragment,
  options: CreateProjectionOptions<FragmentFields<TFragment>, TFragment["$infer"]["output"], TPaths, TProjected>,
): Projection<TProjected> => {
  return new Projection(options.paths, options.handle);
};

/**
 * Creates a projection attachment for use with Fragment.attach().
 *
 * @example
 * ```typescript
 * const fragment = gql(({ fragment }) =>
 *   fragment.Query({
 *     fields: ({ f }) => ({ ...f.user()(({ f }) => ({ ...f.id() })) }),
 *   })
 * ).attach(createProjectionAttachment({
 *   paths: ["$.user.id"],
 *   handle: (result) => result.isSuccess() ? result.unwrap()[0] : null,
 * }));
 * ```
 */
export const createProjectionAttachment = <
  TFragment extends AnyFragment,
  const TPaths extends Tuple<AvailableFieldPathOf<FragmentFields<NoInfer<TFragment>>>>,
  TProjected,
>(
  options: CreateProjectionOptions<
    FragmentFields<NoInfer<TFragment>>,
    NoInfer<TFragment>["$infer"]["output"],
    TPaths,
    TProjected
  >,
): GqlElementAttachment<TFragment, "projection", Projection<TProjected>> => {
  return {
    name: "projection",
    createValue: (fragment) => createProjection(fragment, options),
  };
};
