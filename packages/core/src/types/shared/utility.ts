const _dummy = () => {
  throw new Error("DO NOT CALL THIS FUNCTION -- we use function to safely transfer type information");
};
export const pseudoTypeAnnotation = <T>(): (() => T) => _dummy;
export type PseudoTypeAnnotation<T> = () => T;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export const prettify = <T extends object>(obj: T) => obj as Prettify<T>;

const __EMPTY_SYMBOL__: unique symbol = Symbol("EmptyObjectBrand");
type IsEmptyObject<T> = keyof (T & { [__EMPTY_SYMBOL__]: true }) extends typeof __EMPTY_SYMBOL__ ? true : false;
export type VoidIfEmptyObject<T> = IsEmptyObject<T> extends true ? void : never;

export type EmptyObject = { [__EMPTY_SYMBOL__]: never };
export const empty = (): EmptyObject => ({}) as EmptyObject;

export const wrapValueByKey = <TName extends string, TValue>(name: TName, value: TValue) =>
  ({ [name]: value }) as {
    [K in TName]: TValue;
  };

// REF: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export type Tuple<T> = [T, ...T[]];

export type StripFunctions<T extends object> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

export type StripSymbols<T extends object> = {
  [K in keyof T as K extends symbol ? never : K]: T[K];
};
