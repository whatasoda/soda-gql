import type { AnyGraphqlSchema, InferInputProfile } from "../schema/schema";
import type {
  AnyDefaultValue,
  AnyVarRef,
  ConstValue,
  GetAssignableType,
  InputTypeSpecifier,
  InputTypeSpecifiers,
  TypeProfile,
  VarRef,
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

export type AnyAssigningInput = {
  readonly [key: string]: AnyVarRef;
};

type IsOptional<TSpecifier extends InputTypeSpecifier> = TSpecifier["modifier"] extends `${string}?`
  ? true
  : TSpecifier["defaultValue"] extends AnyDefaultValue
    ? true
    : false;

export type AssignableInput<TSchema extends AnyGraphqlSchema, TSpecifiers extends InputTypeSpecifiers> = {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends true ? K : never]+?: FieldArgumentValue<
    TSchema,
    TSpecifiers[K]
  >;
} & {
  readonly [K in keyof TSpecifiers as IsOptional<TSpecifiers[K]> extends false ? K : never]-?: FieldArgumentValue<
    TSchema,
    TSpecifiers[K]
  >;
};

/**
 * Field argument value type using typeName + kind for VarRef comparison.
 * Uses GetAssignableType which derives typeName + kind from the profile.
 * This name appears in TypeScript error messages when argument types don't match.
 */
export type FieldArgumentValue<TSchema extends AnyGraphqlSchema, TSpecifier extends InputTypeSpecifier> = GetAssignableType<
  InferInputProfile<TSchema, TSpecifier>
>;

/**
 * Declared variables record for an operation or fragment.
 * Maps variable names to their VarRef types with proper branding.
 * This name appears in TypeScript error messages when variable access fails.
 */
export type DeclaredVariables<TSchema extends AnyGraphqlSchema, TSpecifiers extends InputTypeSpecifiers> = {
  readonly [K in keyof TSpecifiers]-?: VarRef<TypeProfile.DeclaredVariableType<InferInputProfile<TSchema, TSpecifiers[K]>>>;
};

export type AssignableInputByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = AssignableInput<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
