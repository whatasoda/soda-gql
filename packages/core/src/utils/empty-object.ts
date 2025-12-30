const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
export type EmptyObject = { readonly [__EMPTY_SYMBOL__]: never };

type IsOmittable<T> = {} extends T ? true : false;
export type IfOmittable<TTarget, TType> = IsOmittable<TTarget> extends true ? TType : never;
export type SwitchIfOmittable<TTarget, TTrue, TFalse> = IsOmittable<TTarget> extends true ? TTrue : TFalse;

export const empty = (): EmptyObject => ({}) as EmptyObject;
