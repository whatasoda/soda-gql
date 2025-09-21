/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlAdapter } from "./adapter";
import type { SliceResultSelection } from "./branded-classes";

/** Either a single selection or a container of multiple named selections. */
export type AnySliceResultSelections<TAdapter extends GraphqlAdapter> =
  | AnySliceResultSelectionSingle<TAdapter>
  | AnySliceResultSelectionMultiple<TAdapter>;

/** Shape of a single selection slice projection. */
export type AnySliceResultSelectionSingle<TAdapter extends GraphqlAdapter> = SliceResultSelection<
  TAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export type AnySliceResultSelectionMultiple<TAdapter extends GraphqlAdapter> = {
  [key: string]: AnySliceResultSelectionSingle<TAdapter>;
};

/** Infer the output type produced by a selection or multi-selection. */
export type InferSliceResultSelection<
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultSelections<TAdapter>,
> = TSelection extends AnySliceResultSelectionSingle<TAdapter>
  ? ReturnType<TSelection["projector"]>
  : TSelection extends AnySliceResultSelectionMultiple<TAdapter>
    ? { [K in keyof TSelection]: ReturnType<TSelection[K]["projector"]> }
    : never;
