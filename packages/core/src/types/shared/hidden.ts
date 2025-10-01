const _dummy = () => {
  throw new Error("DO NOT CALL THIS FUNCTION -- we use function to safely transfer type information");
};
export const hidden = <T>(): (() => T) => _dummy;
export type Hidden<T> = () => T;
