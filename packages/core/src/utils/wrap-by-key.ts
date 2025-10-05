export const wrapByKey = <TName extends string, TValue>(name: TName, value: TValue) =>
  ({
    [name]: value,
  }) as {
    [K in TName]: TValue;
  };
