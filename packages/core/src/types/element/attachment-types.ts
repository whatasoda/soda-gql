/**
 * Shape constraint for attachment objects used in type utilities.
 */
export type AttachmentShape = { name: string; createValue: (element: any) => object };

/**
 * Extracts the property type contribution from a single attachment.
 * Maps GqlElementAttachment<E, N, V> to { [N]: V }
 */
export type AttachmentToProperty<TAttachment> = TAttachment extends {
  name: infer TName extends string;
  createValue: (element: any) => infer TValue extends object;
}
  ? { [K in TName]: TValue }
  : never;

/**
 * Recursively maps a tuple of attachments to an intersection of their properties.
 *
 * @example
 * type Attachments = [
 *   { name: "a"; createValue: (el: any) => { x: number } },
 *   { name: "b"; createValue: (el: any) => { y: string } }
 * ];
 * type Result = AttachmentsTupleToIntersection<Attachments>;
 * // Result: { a: { x: number } } & { b: { y: string } }
 */
export type AttachmentsTupleToIntersection<TAttachments extends readonly AttachmentShape[]> = TAttachments extends readonly [
  infer First extends AttachmentShape,
  ...infer Rest extends readonly AttachmentShape[],
]
  ? AttachmentToProperty<First> & AttachmentsTupleToIntersection<Rest>
  : unknown;
