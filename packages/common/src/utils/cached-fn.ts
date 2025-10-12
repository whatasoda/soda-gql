export const cachedFn = <T>(fn: () => T) => {
  let cached: T | null = null;
  return () => {
    if (!cached) {
      cached = fn();
    }
    return cached;
  };
};
