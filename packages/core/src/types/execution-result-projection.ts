/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlRuntimeAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";
import type { PseudoTypeAnnotation } from "./utility";

declare const __EXECUTION_RESULT_PROJECTION_BRAND__: unique symbol;

/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class ExecutionResultProjection<TRuntimeAdapter extends GraphqlRuntimeAdapter, TPath extends string, TTransformed> {
  declare readonly [__EXECUTION_RESULT_PROJECTION_BRAND__]: PseudoTypeAnnotation<never>;

  constructor(
    public readonly path: TPath,
    // biome-ignore lint/suspicious/noExplicitAny: abstract type
    public readonly projector: (result: SliceResult<any, TRuntimeAdapter>) => TTransformed,
  ) {
    this.pathSegments = createFieldPathSegments(this.path);
  }
  
  public readonly pathSegments: string[];
}

function createFieldPathSegments(path: string): string[] {
  if (path === "$") {
    return [];
  }

  const segments = path.split(".");
  if (segments[0] !== "$") {
    throw new Error("Field path must start with $");
  }
  
  return segments.slice(1);
}

/** Either a single selection or a container of multiple named selections. */
export type AnyExecutionResultProjections<TRuntimeAdapter extends GraphqlRuntimeAdapter> =
  | AnyExecutionResultProjectionSingle<TRuntimeAdapter>
  | AnyExecutionResultProjectionMultiple<TRuntimeAdapter>;

/** Shape of a single selection slice projection. */
export type AnyExecutionResultProjectionSingle<TRuntimeAdapter extends GraphqlRuntimeAdapter> = ExecutionResultProjection<
  TRuntimeAdapter,
  string,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export type AnyExecutionResultProjectionMultiple<TRuntimeAdapter extends GraphqlRuntimeAdapter> = {
  [key: string]: AnyExecutionResultProjectionSingle<TRuntimeAdapter>;
};

/** Infer the output type produced by a selection or multi-selection. */
export type InferExecutionResultProjection<
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TSelection extends AnyExecutionResultProjections<TRuntimeAdapter>,
> = TSelection extends AnyExecutionResultProjectionSingle<TRuntimeAdapter>
  ? ReturnType<TSelection["projector"]>
  : TSelection extends AnyExecutionResultProjectionMultiple<TRuntimeAdapter>
    ? { [K in keyof TSelection]: ReturnType<TSelection[K]["projector"]> }
    : never;
