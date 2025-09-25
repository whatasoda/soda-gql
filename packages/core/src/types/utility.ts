const _hiddenFn = () => {
  throw new Error("DO NOT CALL THIS FUNCTION -- property for type inference");
};
export const hidden = <T>(): (() => T) => _hiddenFn;
export type Hidden<T> = () => T;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export const prettify = <T extends object>(obj: T) => obj as Prettify<T>;

const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
type IsEmptyObject<T> = keyof (T & { [__EMPTY_SYMBOL__]: true }) extends typeof __EMPTY_SYMBOL__ ? true : false;
// biome-ignore lint/suspicious/noConfusingVoidType: Need to use void to make argument optional
export type VoidIfEmptyObject<T> = IsEmptyObject<T> extends true ? void : never;

export type EmptyObject = { [__EMPTY_SYMBOL__]: never };
export const empty = (): EmptyObject => ({}) as EmptyObject;

export const wrapValueByKey = <TName extends string, TValue>(name: TName, value: TValue) =>
  ({ [name]: value }) as {
    [K in TName]: TValue;
  };

// REF: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
export type UnionToIntersection<U> =
  // biome-ignore lint/suspicious/noExplicitAny: idiom
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
