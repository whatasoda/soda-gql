// REF: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export type Tuple<T> = [T, ...T[]];

export type StripFunctions<T extends object> = {
  [K in keyof T as K extends "$infer" ? never : T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

export type StripSymbols<T extends object> = {
  [K in keyof T as K extends symbol | "$infer" ? never : K]: T[K];
};

/**
 * Extracts the property type contribution from a single attachment.
 * Maps GqlElementAttachment<E, N, V> to { [N]: V }
 */
export type AttachmentToProperty<TAttachment> =
  TAttachment extends { name: infer TName extends string; createValue: () => infer TValue extends object }
    ? { [K in TName]: TValue }
    : never;

/**
 * Recursively maps a tuple of attachments to an intersection of their properties.
 *
 * @example
 * type Attachments = [
 *   { name: "a"; createValue: () => { x: number } },
 *   { name: "b"; createValue: () => { y: string } }
 * ];
 * type Result = AttachmentsTupleToIntersection<Attachments>;
 * // Result: { a: { x: number } } & { b: { y: string } }
 */
export type AttachmentsTupleToIntersection<TAttachments extends readonly { name: string; createValue: () => object }[]> =
  TAttachments extends readonly [
    infer First extends { name: string; createValue: () => object },
    ...infer Rest extends readonly { name: string; createValue: () => object }[],
  ]
    ? AttachmentToProperty<First> & AttachmentsTupleToIntersection<Rest>
    : unknown;
