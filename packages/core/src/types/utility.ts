const _hiddenFn = () => {
  throw new Error("DO NOT CALL THIS FUNCTION -- property for type inference");
};

/**
 * Helper function for creating runtime-safe type brand properties
 * @see docs/decisions/002-type-brand-safety.md for design rationale
 *
 * Brand properties are used for TypeScript type inference but should
 * never be accessed at runtime. This function returns a function that
 * throws if called, making the property safe to access (returns undefined
 * function) while preserving type information.
 *
 * @example
 * interface MyType<T> {
 *   readonly _brand: () => T;
 * }
 *
 * const instance: MyType<string> = {
 *   _brand: hiddenBrand(),
 * };
 */
export const hidden = <T>(): (() => T) => _hiddenFn;

export type Hidden<T> = () => T;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export const prettify = <T extends object>(obj: T) => obj as Prettify<T>;
