/** Result-like wrapper types returned from slice projections. */
import type { GraphqlAdapter } from "./adapter";
import type { Prettify } from "./utility";

/**
 * Internal discriminated union describing the Result-like wrapper exposed to
 * slice selection callbacks. The adapter decides how raw errors are
 * materialized.
 */
export type AnySliceResultRecord<TAdapter extends GraphqlAdapter> = {
  [path: string]: SliceResult<
    // biome-ignore lint/suspicious/noExplicitAny: abstract type
    any,
    TAdapter
  >;
};

/** Public union used by selection callbacks to inspect data, empty, or error states. */
export type SliceResult<TData, TAdapter extends GraphqlAdapter> =
  | SliceResultEmpty<TData, TAdapter>
  | SliceResultSuccess<TData, TAdapter>
  | SliceResultError<TData, TAdapter>;

/** Runtime guard interface shared by all slice result variants. */
type SliceResultGuards<TData, TAdapter extends GraphqlAdapter> = {
  isEmpty(): this is SliceResultEmpty<TData, TAdapter>;
  isSuccess(): this is SliceResultSuccess<TData, TAdapter>;
  isError(): this is SliceResultError<TData, TAdapter>;
};

/** Variant representing an empty payload (no data, no error). */
export type SliceResultEmpty<TData, TAdapter extends GraphqlAdapter> = Prettify<
  SliceResultGuards<TData, TAdapter> & {
    unwrap: () => null;
    safeUnwrap: SliceResultSafeUnwrapFn<TData, ReturnType<TAdapter["createError"]>>;
  }
>;

/** Variant representing a successful payload. */
export type SliceResultSuccess<TData, TAdapter extends GraphqlAdapter> = Prettify<
  SliceResultGuards<TData, TAdapter> & {
    data: TData;
    unwrap: () => TData;
    safeUnwrap: SliceResultSafeUnwrapFn<TData, ReturnType<TAdapter["createError"]>>;
  }
>;

/** Variant representing an error payload created by the adapter. */
export type SliceResultError<TData, TAdapter extends GraphqlAdapter> = Prettify<
  SliceResultGuards<TData, TAdapter> & {
    error: ReturnType<TAdapter["createError"]>;
    safeUnwrap: SliceResultSafeUnwrapFn<TData, ReturnType<TAdapter["createError"]>>;
  }
>;

/** Utility signature returned by the safe unwrap helper. */
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
