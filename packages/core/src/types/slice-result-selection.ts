import type { GraphqlAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";

export type SliceResultSelection<TAdapter extends GraphqlAdapter, TPath extends string, TData, TTransformed> = {
  path: TPath;
  transform: (result: SliceResult<TData, TAdapter>) => TTransformed;
};

export type AbstractSliceResultSelection<TAdapter extends GraphqlAdapter> =
  | AbstractSliceResultSelectionSingle<TAdapter>
  | AbstractSliceResultSelectionMultiple<TAdapter>;

type AbstractSliceResultSelectionMultiple<TAdapter extends GraphqlAdapter> = {
  multiple: { [key: string]: AbstractSliceResultSelectionSingle<TAdapter> };
};

type AbstractSliceResultSelectionSingle<TAdapter extends GraphqlAdapter> = SliceResultSelection<
  TAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  any
>;

export type InferSliceResultSelection<
  TAdapter extends GraphqlAdapter,
  TSelection extends AbstractSliceResultSelectionSingle<TAdapter> | AbstractSliceResultSelectionMultiple<TAdapter>,
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
