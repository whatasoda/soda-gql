/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlRuntimeAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";
import type { PseudoTypeAnnotation, Tuple } from "./utility";

declare const __EXECUTION_RESULT_PROJECTION_BRAND__: unique symbol;

/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class ExecutionResultProjection<TRuntimeAdapter extends GraphqlRuntimeAdapter, TPath extends string, TTransformed> {
  declare readonly [__EXECUTION_RESULT_PROJECTION_BRAND__]: PseudoTypeAnnotation<never>;

  constructor(
    paths: Tuple<TPath>,
    // biome-ignore lint/suspicious/noExplicitAny: abstract type
    public readonly projector: (result: SliceResult<any, TRuntimeAdapter>) => TTransformed,
  ) {
    this.paths = createProjectionPaths(paths);
  }

  public readonly paths: ProjectionPath[];
}

export type ProjectionPath = {
  raw: string;
  segments: Tuple<string>;
};

function createProjectionPath(path: string): ProjectionPath {
  const segments = path.split(".");
  if (path === "$" || segments.length <= 1) {
    throw new Error("Field path must not be only $ or empty");
  }

  return {
    raw: path,
    segments: segments.slice(1) as Tuple<string>,
  };
}

function createProjectionPaths(paths: Tuple<string>): ProjectionPath[] {
  console.log(paths);

  return paths.map((path) => createProjectionPath(path));
}

/** Shape of a single selection slice projection. */
export type AnyExecutionResultProjection<TRuntimeAdapter extends GraphqlRuntimeAdapter> = ExecutionResultProjection<
  TRuntimeAdapter,
  string,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

/** Infer the output type produced by a selection or multi-selection. */
export type InferExecutionResultProjection<
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TSelection extends AnyExecutionResultProjection<TRuntimeAdapter>,
> = ReturnType<TSelection["projector"]>;
