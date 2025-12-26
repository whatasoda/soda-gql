/** Result-like wrapper types returned from slice projections. */

import type { NormalizedError } from "./types";

export type AnySlicedExecutionResult = SlicedExecutionResult<any>;

/**
 * Internal discriminated union describing the Result-like wrapper exposed to
 * slice selection callbacks.
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
export type SlicedExecutionResult<TData> =
  | SlicedExecutionResultEmpty<TData>
  | SlicedExecutionResultSuccess<TData>
  | SlicedExecutionResultError<TData>;

/** Runtime guard interface shared by all slice result variants. */
class SlicedExecutionResultGuards<TData> {
  isSuccess(): this is SlicedExecutionResultSuccess<TData> {
    return this.type === "success";
  }
  isError(): this is SlicedExecutionResultError<TData> {
    return this.type === "error";
  }
  isEmpty(): this is SlicedExecutionResultEmpty<TData> {
    return this.type === "empty";
  }

  constructor(private readonly type: "success" | "error" | "empty") {}
}

/** Variant representing an empty payload (no data, no error). */
export class SlicedExecutionResultEmpty<TData>
  extends SlicedExecutionResultGuards<TData>
  implements SlicedExecutionResultCommon<TData, NormalizedError>
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
export class SlicedExecutionResultSuccess<TData>
  extends SlicedExecutionResultGuards<TData>
  implements SlicedExecutionResultCommon<TData, NormalizedError>
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

/** Variant representing an error payload. */
export class SlicedExecutionResultError<TData>
  extends SlicedExecutionResultGuards<TData>
  implements SlicedExecutionResultCommon<TData, NormalizedError>
{
  constructor(
    public readonly error: NormalizedError,
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
