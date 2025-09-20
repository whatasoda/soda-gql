/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";
import { type Hidden, hidden } from "./utility";

declare const __SLICE_RESULT_SELECTION_BRAND__: unique symbol;

/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class SliceResultSelection<TAdapter extends GraphqlAdapter, TPath extends string, TData, TTransformed> {
  [__SLICE_RESULT_SELECTION_BRAND__]: Hidden<never> = hidden();

  constructor(
    public readonly path: TPath,
    public readonly transform: (result: SliceResult<TData, TAdapter>) => TTransformed,
  ) {}
}

/** Either a single selection or a container of multiple named selections. */
export type AnySliceResultSelections<TAdapter extends GraphqlAdapter> =
  | AnySliceResultSelectionSingle<TAdapter>
  | AnySliceResultSelectionMultiple<TAdapter>;

/** Shape of a single selection slice projection. */
type AnySliceResultSelectionSingle<TAdapter extends GraphqlAdapter> = SliceResultSelection<
  TAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

type AnySliceResultSelectionMultiple<TAdapter extends GraphqlAdapter> = {
  [key: string]: AnySliceResultSelectionSingle<TAdapter>;
};

/** Infer the output type produced by a selection or multi-selection. */
export type InferSliceResultSelection<
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultSelections<TAdapter>,
> = TSelection extends AnySliceResultSelectionSingle<TAdapter>
  ? ReturnType<TSelection["transform"]>
  : TSelection extends AnySliceResultSelectionMultiple<TAdapter>
    ? { [K in keyof TSelection]: ReturnType<TSelection[K]["transform"]> }
    : never;
