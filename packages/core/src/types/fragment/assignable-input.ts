import type { AnyGraphqlSchema, InferInputProfile, ResolveInputProfileFromMeta } from "../schema/schema";
import type {
  AnyDefaultValue,
  AnyVarRef,
  ConstValue,
  DeferredInputSpecifier,
  DeferredOutputSpecifier,
  GetAssignableType,
  GetSpecArguments,
  GetSpecDefaultValue,
  GetSpecModifier,
  InputTypeSpecifiers,
  TypeProfile,
  VariableDefinitions,
  VarRef,
  VarSpecifier,
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

type IsOptional<TSpecifier extends DeferredInputSpecifier> = GetSpecModifier<TSpecifier> extends `${string}?`
  ? true
  : GetSpecDefaultValue<TSpecifier> extends AnyDefaultValue
    ? true
    : false;

type IsOptionalVarSpec<TSpec extends VarSpecifier> = TSpec["modifier"] extends `${string}?`
  ? true
  : TSpec["defaultValue"] extends AnyDefaultValue
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
 * Assignable input type for fragment/operation variables.
 * Works with VariableDefinitions (VarSpecifier objects) instead of deferred strings.
 */
export type AssignableInputFromVarDefs<TSchema extends AnyGraphqlSchema, TVarDefs extends VariableDefinitions> = {
  readonly [K in keyof TVarDefs as IsOptionalVarSpec<TVarDefs[K]> extends true ? K : never]+?: FragmentVariableValue<
    TSchema,
    TVarDefs[K]
  >;
} & {
  readonly [K in keyof TVarDefs as IsOptionalVarSpec<TVarDefs[K]> extends false ? K : never]-?: FragmentVariableValue<
    TSchema,
    TVarDefs[K]
  >;
};

/**
 * Fragment variable value type using VarSpecifier properties.
 */
export type FragmentVariableValue<TSchema extends AnyGraphqlSchema, TSpec extends VarSpecifier> = GetAssignableType<
  ResolveInputProfileFromMeta<TSchema, TSpec["name"], TSpec["kind"], TSpec["modifier"]>
>;

/**
 * Field argument value type using typeName + kind for VarRef comparison.
 * Uses GetAssignableType which derives typeName + kind from the profile.
 * This name appears in TypeScript error messages when argument types don't match.
 */
export type FieldArgumentValue<TSchema extends AnyGraphqlSchema, TSpecifier extends DeferredInputSpecifier> = GetAssignableType<
  InferInputProfile<TSchema, TSpecifier>
>;

/**
 * Declared variables record for an operation or fragment.
 * Maps variable names to their VarRef types with proper branding.
 * This name appears in TypeScript error messages when variable access fails.
 */
export type DeclaredVariables<TSchema extends AnyGraphqlSchema, TVarDefs extends VariableDefinitions> = {
  readonly [K in keyof TVarDefs]-?: VarRef<
    TypeProfile.DeclaredVariableType<
      ResolveInputProfileFromMeta<TSchema, TVarDefs[K]["name"], TVarDefs[K]["kind"], TVarDefs[K]["modifier"]>
    >
  >;
};

export type AssignableInputByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = AssignableInput<TSchema, GetSpecArguments<TSchema["object"][TTypeName]["fields"][TFieldName] & string>>;
