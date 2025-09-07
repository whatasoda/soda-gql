export const hiddenBrand =
  <T>(): (() => T) =>
  () => {
    throw new Error("DO NOT CALL THIS FUNCTION -- property for type inference");
  };
