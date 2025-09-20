/** Slice selection descriptors produced by `gql.querySlice`. */
import type { GraphqlAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";

/**
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export type SliceResultSelection<TAdapter extends GraphqlAdapter, TPath extends string, TData, TTransformed> = {
  path: TPath;
  transform: (result: SliceResult<TData, TAdapter>) => TTransformed;
};

/** Either a single selection or a container of multiple named selections. */
export type AnySliceResultSelection<TAdapter extends GraphqlAdapter> =
  | AnySliceResultSelectionSingle<TAdapter>
  | AnySliceResultSelectionMultiple<TAdapter>;

/** Shape of a multi-selection slice projection. */
type AnySliceResultSelectionMultiple<TAdapter extends GraphqlAdapter> = {
  multiple: { [key: string]: AnySliceResultSelectionSingle<TAdapter> };
};

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

/** Infer the output type produced by a selection or multi-selection. */
export type InferSliceResultSelection<
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultSelectionSingle<TAdapter> | AnySliceResultSelectionMultiple<TAdapter>,
> = TSelection extends { multiple: unknown }
  ? {
      [K in keyof TSelection["multiple"]]: TSelection["multiple"][K] extends {
        transform: (result: infer _) => infer TTransformed;
      }
        ? TTransformed
        : never;
    }
  : TSelection extends {
        transform: (result: infer _) => infer TTransformed;
      }
    ? TTransformed
    : never;
