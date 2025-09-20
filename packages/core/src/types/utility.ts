const _hiddenFn = () => {
  throw new Error("DO NOT CALL THIS FUNCTION -- property for type inference");
};
export const hidden = <T>(): (() => T) => _hiddenFn;
export type Hidden<T> = () => T;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export const prettify = <T extends object>(obj: T) => obj as Prettify<T>;

declare const __EMPTY_SYMBOL__: unique symbol;
type IsEmptyObject<T> = keyof (T & { [__EMPTY_SYMBOL__]: true }) extends typeof __EMPTY_SYMBOL__ ? true : false;
// biome-ignore lint/suspicious/noConfusingVoidType: Need to use void to make argument optional
export type VoidIfEmptyObject<T> = IsEmptyObject<T> extends true ? void : never;

export type EmptyObject = { [__EMPTY_SYMBOL__]: never };
