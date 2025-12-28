// REF: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export type Tuple<T> = [T, ...T[]];

export type StripFunctions<T extends object> = {
  [K in keyof T as K extends "$infer" ? never : T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

export type StripSymbols<T extends object> = {
  [K in keyof T as K extends symbol | "$infer" | "attach" ? never : K]: T[K];
};
