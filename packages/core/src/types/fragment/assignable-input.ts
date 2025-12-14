import type { AnyGraphqlSchema, InferInputProfile } from "../schema/schema";
import type {
  AnyDefaultValue,
  AnyVarRef,
  ConstValue,
  GetAssignableType,
  InputTypeSpecifier,
  InputTypeSpecifiers,
} from "../type-foundation";

export type AnyAssignableInputValue =
  | ConstValue
  | AnyVarRef
  | { [key: string]: AnyAssignableInputValue }
  | AnyAssignableInputValue[]
  | undefined
  | null;

export type AnyAssignableInput = {
  readonly [key: string]: AnyAssignableInputValue;
};

type IsOptional<TSpecifier extends InputTypeSpecifier> = TSpecifier["modifier"] extends `${string}?`
  ? true
  : TSpecifier["defaultValue"] extends AnyDefaultValue
    ? true
    : false;

export type AssignableInput<TSchema extends AnyGraphqlSchema, TSpecifiers extends InputTypeSpecifiers> = {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends true ? K : never]+?: AssignableInputValue<
    TSchema,
    TSpecifiers[K]
  >;
} & {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends false ? K : never]-?: AssignableInputValue<
    TSchema,
    TSpecifiers[K]
  >;
};

export type AssignableInputValue<TSchema extends AnyGraphqlSchema, TSpecifier extends InputTypeSpecifier> = GetAssignableType<
  InferInputProfile<TSchema, TSpecifier>,
  TSpecifier["modifier"],
  InputTypeSpecifier["defaultValue"] extends AnyDefaultValue ? true : false
>;

export type AssignableInputByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = AssignableInput<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
