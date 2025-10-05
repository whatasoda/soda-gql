export const mapValues = <T extends object, TResult>(
  obj: T,
  fn: (...args: { [K in keyof T]: [value: T[K], key: K] }[keyof T]) => TResult,
): { [K in keyof T]: TResult } => {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn(value, key)])) as Record<keyof T, TResult>;
};
