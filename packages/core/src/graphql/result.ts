/**
 * Self-contained Result type for GraphQL parser utilities.
 * Avoids neverthrow dependency in @soda-gql/core.
 * @module
 */

/** Discriminated union: ok=true carries value, ok=false carries error */
export type Result<T, E> = OkResult<T> | ErrResult<E>;

export type OkResult<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ErrResult<E> = {
  readonly ok: false;
  readonly error: E;
};

/** Create a successful Result */
export const ok = <T>(value: T): OkResult<T> => ({
  ok: true,
  value,
});

/** Create a failed Result */
export const err = <E>(error: E): ErrResult<E> => ({
  ok: false,
  error,
});
