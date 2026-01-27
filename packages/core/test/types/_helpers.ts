/**
 * Type-level test assertion helpers.
 *
 * These utilities enable compile-time type assertions without runtime overhead.
 * Pattern follows existing deferred-specifier.test.ts conventions.
 *
 * @module
 */

/**
 * Type-level assertion that T extends true.
 * Used to mark compile-time type checks.
 *
 * @example
 * type _Test = Expect<Equal<string, string>>; // compiles
 * type _Fail = Expect<Equal<string, number>>; // error: Type 'false' does not satisfy 'true'
 */
export type Expect<T extends true> = T;

/**
 * Deep structural equality check between two types.
 * Returns true if X and Y are structurally identical.
 *
 * Uses function signature comparison to avoid distribution over unions.
 */
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/**
 * Inverse of Equal - returns true if types are NOT equal.
 */
export type NotEqual<X, Y> = Equal<X, Y> extends true ? false : true;

/**
 * Check if T extends U (subtype relationship).
 */
export type Extends<T, U> = T extends U ? true : false;

/**
 * Check if T is the never type.
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Check if object T has key K.
 */
export type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

/**
 * Check if T is any.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Check if T is unknown.
 */
export type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;

/**
 * Bidirectional extends check (structural compatibility).
 * Returns true if A extends B AND B extends A.
 * Unlike Equal, this ignores symbol properties that may be added internally.
 */
export type Equivalent<A, B> = A extends B ? (B extends A ? true : false) : false;

/**
 * Extract only string/number keys from a type (excluding symbols).
 * Useful for comparing user-facing shapes.
 */
export type PublicKeys<T> = Extract<keyof T, string | number>;

/**
 * Pick only public (non-symbol) properties from a type.
 */
export type PublicShape<T> = { [K in PublicKeys<T>]: T[K] };

/**
 * Equal comparison ignoring internal symbol properties.
 * Use this for testing inferred types that may have internal branded properties.
 */
export type EqualPublic<X, Y> = Equal<PublicShape<X>, PublicShape<Y>>;
