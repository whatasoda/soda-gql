import type {
  AnyDefaultValue,
  ConstValue,
  DeferredInputSpecifier,
  GetConstAssignableType,
  GetSpecDefaultValue,
  GetSpecModifier,
  InputTypeSpecifiers,
  VariableDefinitions,
  VarSpecifier,
} from "../type-foundation";
import type { AnyGraphqlSchema, InferInputProfile, ResolveInputProfileFromMeta } from "./schema";

export type AnyConstAssignableInputValue = ConstValue;
export type AnyConstAssignableInput = {
  readonly [key: string]: AnyConstAssignableInputValue;
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

/**
 * Constant-only assignable input type for operation variables.
 * Works with VariableDefinitions (VarSpecifier objects) instead of deferred strings.
 */
export type ConstAssignableInputFromVarDefs<TSchema extends AnyGraphqlSchema, TVarDefs extends VariableDefinitions> = {
  readonly [K in keyof TVarDefs as IsOptionalVarSpec<TVarDefs[K]> extends true ? K : never]+?: ConstAssignableInputValueFromVarSpec<
    TSchema,
    TVarDefs[K]
  >;
} & {
  readonly [K in keyof TVarDefs as IsOptionalVarSpec<TVarDefs[K]> extends false ? K : never]-?: ConstAssignableInputValueFromVarSpec<
    TSchema,
    TVarDefs[K]
  >;
};

export type ConstAssignableInputValue<
  TSchema extends AnyGraphqlSchema,
  TSpecifier extends DeferredInputSpecifier,
> = GetConstAssignableType<InferInputProfile<TSchema, TSpecifier>> & {};

export type ConstAssignableInputValueFromVarSpec<
  TSchema extends AnyGraphqlSchema,
  TSpec extends VarSpecifier,
> = GetConstAssignableType<ResolveInputProfileFromMeta<TSchema, TSpec["name"], TSpec["kind"], TSpec["modifier"]>> & {};
