/** Utilities for inferring types at field paths from TOutput. */

export type AnyOutputPath = string;

/** Maximum recursion depth to prevent infinite type instantiation. */
type MaxDepth = [unknown, unknown, unknown, unknown, unknown]; // 5 levels

/**
 * Get the TypeScript type at a given path from TOutput.
 *
 * @example
 * ```typescript
 * type Output = { user: { id: string; name: string } };
 * type IdType = InferByOutputPath<Output, "$.user.id">; // string
 * ```
 */
export type InferByOutputPath<TOutput extends object, TPath extends AnyOutputPath> = TPath extends "$"
  ? TOutput
  : InferByOutputPathInner<TOutput, TPath, "$", MaxDepth>;

/**
 * Internal helper that walks the output type while matching path segments.
 * Handles arrays and nullables transparently.
 */
type InferByOutputPathInner<
  TOutput,
  TPathTarget extends AnyOutputPath,
  TPathCurrent extends AnyOutputPath,
  TDepth extends readonly unknown[],
> = TDepth extends readonly []
  ? never
  : TOutput extends readonly (infer TElement)[]
    ? InferByOutputPathInner<TElement, TPathTarget, TPathCurrent, TDepth>
    : TOutput extends object
      ? {
          readonly [K in keyof TOutput & string]: `${TPathCurrent}.${K}` extends TPathTarget
            ? TOutput[K]
            : InferByOutputPathInner<
                  NonNullable<TOutput[K]>,
                  TPathTarget,
                  `${TPathCurrent}.${K}`,
                  DecrementDepth<TDepth>
                > extends infer TInner
              ? TInner extends never
                ? never
                : null extends TOutput[K]
                  ? TInner | null
                  : TInner
              : never;
        }[keyof TOutput & string]
      : never;

/** Decrement depth counter for recursion limiting. */
type DecrementDepth<D extends readonly unknown[]> = D extends readonly [unknown, ...infer Rest] ? Rest : [];

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
