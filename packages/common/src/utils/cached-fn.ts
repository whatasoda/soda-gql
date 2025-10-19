export const cachedFn = <T>(fn: () => T) => {
  let cached: { value: T } | null = null;

  const ensure = () => (cached ??= { value: fn() }).value;
  ensure.clear = () => {
    cached = null;
  };

  return ensure;
};
