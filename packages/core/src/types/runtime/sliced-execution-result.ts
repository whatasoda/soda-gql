/** Result-like wrapper types returned from slice projections. */

import type { NormalizedError } from "./execution-result";
import type { AnyGraphqlRuntimeAdapter } from "./runtime-adapter";

export type AnySlicedExecutionResult = SlicedExecutionResult<any, AnyGraphqlRuntimeAdapter>;

/**
 * Internal discriminated union describing the Result-like wrapper exposed to
 * slice selection callbacks. The adapter decides how raw errors are
 * materialized.
 */
export type AnySlicedExecutionResultRecord = {
  [path: string]: AnySlicedExecutionResult;
};

export type SafeUnwrapResult<TTransformed, TError> =
  | {
      data?: never;
      error?: never;
    }
  | {
      data: TTransformed;
      error?: never;
    }
  | {
      data?: never;
      error: TError;
    };

/** Utility signature returned by the safe unwrap helper. */
type SlicedExecutionResultCommon<TData, TError> = {
  safeUnwrap<TTransformed>(transform: (data: TData) => TTransformed): SafeUnwrapResult<TTransformed, TError>;
};

/** Public union used by selection callbacks to inspect data, empty, or error states. */
export type SlicedExecutionResult<TData, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> =
  | SlicedExecutionResultEmpty<TData, TRuntimeAdapter>
  | SlicedExecutionResultSuccess<TData, TRuntimeAdapter>
  | SlicedExecutionResultError<TData, TRuntimeAdapter>;

/** Runtime guard interface shared by all slice result variants. */
class SlicedExecutionResultGuards<TData, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> {
  isSuccess(): this is SlicedExecutionResultSuccess<TData, TRuntimeAdapter> {
    return this.type === "success";
  }
  isError(): this is SlicedExecutionResultError<TData, TRuntimeAdapter> {
    return this.type === "error";
  }
  isEmpty(): this is SlicedExecutionResultEmpty<TData, TRuntimeAdapter> {
    return this.type === "empty";
  }

  constructor(private readonly type: "success" | "error" | "empty") {}
}

/** Variant representing an empty payload (no data, no error). */
export class SlicedExecutionResultEmpty<TData, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>
  extends SlicedExecutionResultGuards<TData, TRuntimeAdapter>
  implements SlicedExecutionResultCommon<TData, NormalizedError<TRuntimeAdapter>>
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
export class SlicedExecutionResultSuccess<TData, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>
  extends SlicedExecutionResultGuards<TData, TRuntimeAdapter>
  implements SlicedExecutionResultCommon<TData, NormalizedError<TRuntimeAdapter>>
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
export class SlicedExecutionResultError<TData, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>
  extends SlicedExecutionResultGuards<TData, TRuntimeAdapter>
  implements SlicedExecutionResultCommon<TData, NormalizedError<TRuntimeAdapter>>
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
