export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export function prettify<T extends object>(obj: T) {
  return obj as Prettify<T>;
}
