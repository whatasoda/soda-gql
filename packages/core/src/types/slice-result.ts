/** Result-like wrapper types returned from slice projections. */
import type { GraphqlRuntimeAdapter } from "./adapter";
import type { NormalizedError } from "./execution-result";

/**
 * Internal discriminated union describing the Result-like wrapper exposed to
 * slice selection callbacks. The adapter decides how raw errors are
 * materialized.
 */
export type AnySliceResultRecord<TRuntimeAdapter extends GraphqlRuntimeAdapter> = {
  [path: string]: SliceResult<
    // biome-ignore lint/suspicious/noExplicitAny: abstract type
    any,
    TRuntimeAdapter
  >;
};

/** Utility signature returned by the safe unwrap helper. */
type SliceResultCommon<TData, TError> = {
  safeUnwrap<TTransformed>(transform: (data: TData) => TTransformed):
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
};

/** Public union used by selection callbacks to inspect data, empty, or error states. */
export type SliceResult<TData, TRuntimeAdapter extends GraphqlRuntimeAdapter> =
  | SliceResultEmpty<TData, TRuntimeAdapter>
  | SliceResultSuccess<TData, TRuntimeAdapter>
  | SliceResultError<TData, TRuntimeAdapter>;

/** Runtime guard interface shared by all slice result variants. */
class SliceResultGuards<TData, TRuntimeAdapter extends GraphqlRuntimeAdapter> {
  isSuccess(): this is SliceResultSuccess<TData, TRuntimeAdapter> {
    return this.type === "success";
  }
  isError(): this is SliceResultError<TData, TRuntimeAdapter> {
    return this.type === "error";
  }
  isEmpty(): this is SliceResultEmpty<TData, TRuntimeAdapter> {
    return this.type === "empty";
  }

  constructor(private readonly type: "success" | "error" | "empty") {}
}

/** Variant representing an empty payload (no data, no error). */
export class SliceResultEmpty<TData, TRuntimeAdapter extends GraphqlRuntimeAdapter>
  extends SliceResultGuards<TData, TRuntimeAdapter>
  implements SliceResultCommon<TData, NormalizedError<TRuntimeAdapter>>
{
  constructor() {
    super("empty");
  }

  unwrap(): null {
    return null;
  }

  safeUnwrap() {
    return {
      data: undefined,
      error: undefined,
    };
  }
}

/** Variant representing a successful payload. */
export class SliceResultSuccess<TData, TRuntimeAdapter extends GraphqlRuntimeAdapter>
  extends SliceResultGuards<TData, TRuntimeAdapter>
  implements SliceResultCommon<TData, NormalizedError<TRuntimeAdapter>>
{
  constructor(
    public readonly data: TData,
    public readonly extensions?: unknown,
  ) {
    super("success");
  }

  unwrap(): TData {
    return this.data;
  }

  safeUnwrap<TTransformed>(transform: (data: TData) => TTransformed) {
    return {
      data: transform(this.data),
      error: undefined,
    };
  }
}

/** Variant representing an error payload created by the adapter. */
export class SliceResultError<TData, TRuntimeAdapter extends GraphqlRuntimeAdapter>
  extends SliceResultGuards<TData, TRuntimeAdapter>
  implements SliceResultCommon<TData, NormalizedError<TRuntimeAdapter>>
{
  constructor(
    public readonly error: NormalizedError<TRuntimeAdapter>,
    public readonly extensions?: unknown,
  ) {
    super("error");
  }

  unwrap(): never {
    throw this.error;
  }

  safeUnwrap() {
    return {
      data: undefined,
      error: this.error,
    };
  }
}
