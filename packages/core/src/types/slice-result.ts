import type { GraphqlAdapter } from "./adapter";
import type { Prettify } from "./utility";

export type AnySliceResultRecord<TAdapter extends GraphqlAdapter> = {
  [path: string]: SliceResult<
    // biome-ignore lint/suspicious/noExplicitAny: abstract type
    any,
    TAdapter
  >;
};

export type SliceResult<TData, TAdapter extends GraphqlAdapter> =
  | SliceResultEmpty<TData, TAdapter>
  | SliceResultSuccess<TData, TAdapter>
  | SliceResultError<TData, TAdapter>;

type SliceResultGuards<TData, TAdapter extends GraphqlAdapter> = {
  isEmpty(): this is SliceResultEmpty<TData, TAdapter>;
  isSuccess(): this is SliceResultSuccess<TData, TAdapter>;
  isError(): this is SliceResultError<TData, TAdapter>;
};

export type SliceResultEmpty<TData, TAdapter extends GraphqlAdapter> = Prettify<
  SliceResultGuards<TData, TAdapter> & {
    unwrap: () => null;
    safeUnwrap: SliceResultSafeUnwrapFn<TData, ReturnType<TAdapter["createError"]>>;
  }
>;

export type SliceResultSuccess<TData, TAdapter extends GraphqlAdapter> = Prettify<
  SliceResultGuards<TData, TAdapter> & {
    data: TData;
    unwrap: () => TData;
    safeUnwrap: SliceResultSafeUnwrapFn<TData, ReturnType<TAdapter["createError"]>>;
  }
>;

export type SliceResultError<TData, TAdapter extends GraphqlAdapter> = Prettify<
  SliceResultGuards<TData, TAdapter> & {
    error: ReturnType<TAdapter["createError"]>;
    safeUnwrap: SliceResultSafeUnwrapFn<TData, ReturnType<TAdapter["createError"]>>;
  }
>;

type SliceResultSafeUnwrapFn<TData, TError> = <TTransformed>(transform: (data: TData) => TTransformed) =>
  | {
      data?: never;
      error?: never;
    }
  | {
      data: NoInfer<TTransformed>;
      error?: never;
    }
  | {
      data?: never;
      error: TError;
    };
