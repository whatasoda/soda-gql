/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";
import type { Hidden } from "./utility";

declare const __EXECUTION_RESULT_PROJECTION_BRAND__: unique symbol;

/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class ExecutionResultProjection<TAdapter extends GraphqlAdapter, TPath extends string, TData, TTransformed> {
  declare readonly [__EXECUTION_RESULT_PROJECTION_BRAND__]: Hidden<never>;

  constructor(
    public readonly path: TPath,
    public readonly projector: (result: SliceResult<TData, TAdapter>) => TTransformed,
  ) {}
}

/** Either a single selection or a container of multiple named selections. */
export type AnyExecutionResultProjections<TAdapter extends GraphqlAdapter> =
  | AnyExecutionResultProjectionSingle<TAdapter>
  | AnyExecutionResultProjectionMultiple<TAdapter>;

/** Shape of a single selection slice projection. */
export type AnyExecutionResultProjectionSingle<TAdapter extends GraphqlAdapter> = ExecutionResultProjection<
  TAdapter,
  string,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export type AnyExecutionResultProjectionMultiple<TAdapter extends GraphqlAdapter> = {
  [key: string]: AnyExecutionResultProjectionSingle<TAdapter>;
};

/** Infer the output type produced by a selection or multi-selection. */
export type InferExecutionResultProjection<
  TAdapter extends GraphqlAdapter,
  TSelection extends AnyExecutionResultProjections<TAdapter>,
> = TSelection extends AnyExecutionResultProjectionSingle<TAdapter>
  ? ReturnType<TSelection["projector"]>
  : TSelection extends AnyExecutionResultProjectionMultiple<TAdapter>
    ? { [K in keyof TSelection]: ReturnType<TSelection[K]["projector"]> }
    : never;
