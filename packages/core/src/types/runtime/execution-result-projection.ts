import type { Hidden } from "../shared/hidden";
import type { Tuple } from "../shared/utility";
import type { AnySlicedExecutionResult } from "./sliced-execution-result";

/** Shape of a single selection slice projection. */
export type AnyExecutionResultProjection = ExecutionResultProjection<any>;

declare const __EXECUTION_RESULT_PROJECTION_BRAND__: unique symbol;
/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class ExecutionResultProjection<TProjected> {
  declare readonly [__EXECUTION_RESULT_PROJECTION_BRAND__]: Hidden<never>;
  constructor(
    paths: Tuple<string>,
    public readonly projector: (result: AnySlicedExecutionResult) => TProjected,
  ) {
    this.paths = paths.map((path) => createProjectionPath(path));
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

/** Infer the output type produced by a selection or multi-selection. */
export type InferExecutionResultProjection<TProjection extends AnyExecutionResultProjection> = ReturnType<
  TProjection["projector"]
>;
