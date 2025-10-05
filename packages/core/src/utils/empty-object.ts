const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
export type EmptyObject = { [__EMPTY_SYMBOL__]: never };

type IsEmptyObject<T> = keyof (T & EmptyObject) extends keyof EmptyObject ? true : false;
export type IfEmpty<TTarget, TType> = IsEmptyObject<TTarget> extends true ? TType : never;
export type SwitchIfEmpty<TTarget, TTrue, TFalse> = IsEmptyObject<TTarget> extends true ? TTrue : TFalse;

export const empty = (): EmptyObject => ({}) as EmptyObject;
