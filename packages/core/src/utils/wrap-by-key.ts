export function wrapByKey<TName extends string, TValue>(name: TName, value: TValue) {
  return {
    [name]: value,
  } as {
    [K in TName]: TValue;
  };
}
