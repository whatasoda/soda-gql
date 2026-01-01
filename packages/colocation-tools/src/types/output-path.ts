/** Utilities for inferring types at field paths from TOutput. */

export type AnyOutputPath = string;

/**
 * Get the TypeScript type at a given path from TOutput.
 *
 * Note: No depth limiting needed here because TOutput is already
 * computed from InferFields and has finite depth.
 *
 * @example
 * ```typescript
 * type Output = { user: { id: string; name: string } };
 * type IdType = InferByOutputPath<Output, "$.user.id">; // string
 * ```
 */
export type InferByOutputPath<TOutput extends object, TPath extends AnyOutputPath> = TPath extends "$"
  ? TOutput
  : InferByOutputPathInner<TOutput, TPath, "$">;

/**
 * Internal helper that walks the output type while matching path segments.
 * Handles arrays and nullables transparently.
 */
type InferByOutputPathInner<
  TOutput,
  TPathTarget extends AnyOutputPath,
  TPathCurrent extends AnyOutputPath,
> = TOutput extends readonly (infer _)[] // Arrays are not supported
  ? never
  : TOutput extends object
    ? {
        readonly [K in keyof TOutput]-?: K extends string
          ? `${TPathCurrent}.${K}` extends TPathTarget
            ? TOutput[K]
            : InferByOutputPathInner<TOutput[K], TPathTarget, `${TPathCurrent}.${K}`>
          : never;
      }[keyof TOutput]
    : Extract<TOutput, undefined | null>; // Should keep undefined and null in the middle of the path

/**
 * Infer a tuple of types from a tuple of paths.
 *
 * @example
 * ```typescript
 * type Output = { user: { id: string; name: string } };
 * type Tuple = InferPathsOutput<Output, ["$.user.id", "$.user.name"]>;
 * // Result: [string, string]
 * ```
 */
export type InferPathsOutput<TOutput extends object, TPaths extends readonly string[]> = TPaths extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[],
]
  ? [InferByOutputPath<TOutput, First>, ...InferPathsOutput<TOutput, Rest>]
  : [];
