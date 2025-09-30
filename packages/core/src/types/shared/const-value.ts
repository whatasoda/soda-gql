export type ConstValue = string | number | boolean | null | undefined | { [key: string]: ConstValue } | ConstValue[];
export type ConstValues = {
  [key: string]: ConstValue;
};
