const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
type IsEmptyObject<T> = keyof (T & { [__EMPTY_SYMBOL__]: true }) extends typeof __EMPTY_SYMBOL__ ? true : false;
export type IfEmpty<TTarget, TType> = IsEmptyObject<TTarget> extends true ? TType : never;
export type SwitchIfEmpty<TTarget, TTrue, TFalse> = IsEmptyObject<TTarget> extends true ? TTrue : TFalse;

export type EmptyObject = { [__EMPTY_SYMBOL__]: never };
export const empty = (): EmptyObject => ({}) as EmptyObject;
