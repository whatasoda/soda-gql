import type {
  AnyDefaultValue,
  ConstValue,
  GetConstAssignableType,
  GetSpecDefaultValue,
  GetSpecModifier,
  InputFieldSpec,
  InputTypeSpecifier,
  InputTypeSpecifiers,
} from "../type-foundation";
import type { AnyGraphqlSchema, InferInputProfile } from "./schema";

export type AnyConstAssignableInputValue = ConstValue;
export type AnyConstAssignableInput = {
  readonly [key: string]: AnyConstAssignableInputValue;
};

type IsOptional<TSpecifier extends InputFieldSpec> = GetSpecModifier<TSpecifier> extends `${string}?`
  ? true
  : GetSpecDefaultValue<TSpecifier> extends AnyDefaultValue
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

export type ConstAssignableInputValue<
  TSchema extends AnyGraphqlSchema,
  TSpecifier extends InputTypeSpecifier,
> = GetConstAssignableType<InferInputProfile<TSchema, TSpecifier>> & {};
