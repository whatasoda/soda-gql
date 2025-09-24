/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";
import type { Hidden } from "./utility";

declare const __SLICE_RESULT_PROJECTION_BRAND__: unique symbol;

/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class SliceResultProjection<TAdapter extends GraphqlAdapter, TPath extends string, TData, TTransformed> {
  declare readonly [__SLICE_RESULT_PROJECTION_BRAND__]: Hidden<never>;

  constructor(
    public readonly path: TPath,
    public readonly projector: (result: SliceResult<TData, TAdapter>) => TTransformed,
  ) {}
}

/** Either a single selection or a container of multiple named selections. */
export type AnySliceResultProjections<TAdapter extends GraphqlAdapter> =
  | AnySliceResultProjectionSingle<TAdapter>
  | AnySliceResultProjectionMultiple<TAdapter>;

/** Shape of a single selection slice projection. */
export type AnySliceResultProjectionSingle<TAdapter extends GraphqlAdapter> = SliceResultProjection<
  TAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export type AnySliceResultProjectionMultiple<TAdapter extends GraphqlAdapter> = {
  [key: string]: AnySliceResultProjectionSingle<TAdapter>;
};

/** Infer the output type produced by a selection or multi-selection. */
export type InferSliceResultProjection<
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultProjections<TAdapter>,
> = TSelection extends AnySliceResultProjectionSingle<TAdapter>
  ? ReturnType<TSelection["projector"]>
  : TSelection extends AnySliceResultProjectionMultiple<TAdapter>
    ? { [K in keyof TSelection]: ReturnType<TSelection[K]["projector"]> }
    : never;
