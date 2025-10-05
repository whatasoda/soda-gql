export type ConstValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { readonly [key: string]: ConstValue }
  | readonly ConstValue[];
export type ConstValues = {
  readonly [key: string]: ConstValue;
};
