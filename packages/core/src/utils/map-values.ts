type ArgEntries<T extends object> = { [K in keyof T]-?: [value: T[K], key: K] }[keyof T];
type Entries<T extends object> = { [K in keyof T]: [key: K, value: T[K]] }[keyof T];

export function mapValues<TObject extends object, TMappedValue>(
  obj: TObject,
  fn: (...args: ArgEntries<TObject>) => TMappedValue,
): {
  [K in keyof TObject]: TMappedValue;
} {
  return Object.fromEntries((Object.entries(obj) as Entries<TObject>[]).map(([key, value]) => [key, fn(value, key)])) as {
    [K in keyof TObject]: TMappedValue;
  };
}
