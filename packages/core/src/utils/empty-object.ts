const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
export type EmptyObject = { readonly [__EMPTY_SYMBOL__]: never };

type IsEmpty<T> = keyof T extends never ? true : false;
type IsOmittable<T> = {} extends T ? true : false;

export type IfOmittable<TTarget, TType> = IsOmittable<TTarget> extends true ? TType : never;
export type SwitchIfOmittable<TTarget, TTrue, TFalse> = IsOmittable<TTarget> extends true ? TTrue : TFalse;

/**
 * Make argument optional based on type structure:
 * - Empty object (no keys) → void (must omit)
 * - All-optional object → T | void (can omit or provide)
 * - Has required fields → T (must provide)
 */
export type OptionalArg<T> = IsEmpty<T> extends true ? void : IsOmittable<T> extends true ? T | void : T;

export const empty = (): EmptyObject => ({}) as EmptyObject;
