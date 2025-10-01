const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
type IsEmptyObject<T> = keyof (T & { [__EMPTY_SYMBOL__]: true }) extends typeof __EMPTY_SYMBOL__ ? true : false;
export type VoidIfEmptyObject<T> = IsEmptyObject<T> extends true ? void : never;

export type EmptyObject = { [__EMPTY_SYMBOL__]: never };
export const empty = (): EmptyObject => ({}) as EmptyObject;
