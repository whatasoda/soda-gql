import type { ConstValue } from "./const-value";
import type { AnyGraphqlSchema, InferInputProfile } from "./schema";
import type { GetModifiedType } from "./type-modifier";
import type { AnyDefaultValue, InputTypeSpecifier, InputTypeSpecifiers } from "./type-specifier";

export type AnyConstAssignableInputValue = ConstValue;
export type AnyConstAssignableInput = {
  readonly [key: string]: AnyConstAssignableInputValue;
};

type IsOptional<TSpecifier extends InputTypeSpecifier> = TSpecifier["modifier"] extends `${string}?`
  ? true
  : TSpecifier["defaultValue"] extends AnyDefaultValue
    ? true
    : false;

export type ConstAssignableInput<TSchema extends AnyGraphqlSchema, TSpecifiers extends InputTypeSpecifiers> = {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends true ? K : never]+?: ConstAssignableInputValue<
    TSchema,
    TSpecifiers[K]
  >;
} & {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends false ? K : never]-?: ConstAssignableInputValue<
    TSchema,
    TSpecifiers[K]
  >;
};

export type ConstAssignableInputValue<TSchema extends AnyGraphqlSchema, TSpecifier extends InputTypeSpecifier> =
  | (TSpecifier extends { defaultValue: null } ? never : undefined)
  | GetModifiedType<InferInputProfile<TSchema, TSpecifier>, TSpecifier["modifier"]>;
