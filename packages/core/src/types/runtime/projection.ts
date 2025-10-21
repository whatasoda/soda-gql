import type { Hidden } from "../../utils/hidden";
import type { Tuple } from "../../utils/type-utils";
import type { AnySlicedExecutionResult } from "./sliced-execution-result";

/** Shape of a single selection slice projection. */
export type AnyProjection = Projection<any>;

declare const __PROJECTION_BRAND__: unique symbol;
/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class Projection<TProjected> {
  declare readonly [__PROJECTION_BRAND__]: Hidden<never>;
  constructor(
    paths: Tuple<string>,
    public readonly projector: (result: AnySlicedExecutionResult) => TProjected,
  ) {
    this.paths = paths.map((path) => createProjectionPath(path));
  }

  public readonly paths: ProjectionPath[];
}

export type ProjectionPath = {
  full: string;
  segments: Tuple<string>;
};

function createProjectionPath(path: string): ProjectionPath {
  const segments = path.split(".");
  if (path === "$" || segments.length <= 1) {
    throw new Error("Field path must not be only $ or empty");
  }

  return {
    full: path,
    segments: segments.slice(1) as Tuple<string>,
  };
}

export type InferExecutionResultProjection<TProjection extends AnyProjection> = ReturnType<TProjection["projector"]>;
