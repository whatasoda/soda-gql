import type {
  AllInputTypeNames,
  AnyConstDirectiveAttachments,
  AnyGraphqlSchema,
  ConstAssignableInputValue,
  InferInputKind,
} from "../types/schema";
import type { InputTypeKind, TypeModifier } from "../types/type-foundation";
import { getVarRefInner, getVarRefName, getVarRefValue } from "../types/type-foundation/var-ref";
import { wrapByKey } from "../utils/wrap-by-key";

/**
 * Type for the default value function for a variable.
 */
type AssignableDefaultValue<
  TSchema extends AnyGraphqlSchema,
  TKind extends InputTypeKind,
  TName extends string,
  TModifier extends TypeModifier,
> = ConstAssignableInputValue<
  TSchema,
  {
    scalar: { kind: "scalar"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
    enum: { kind: "enum"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
    input: { kind: "input"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
  }[TKind]
>;

/**
 * Variable specifier type.
 */
export type VarSpecifier<
  TKind extends InputTypeKind,
  TTypeName extends string,
  TModifier extends TypeModifier,
  TDefaultFn extends (() => unknown) | null,
  TDirectives extends AnyConstDirectiveAttachments,
> = {
  kind: TKind;
  name: TTypeName;
  modifier: TModifier;
  defaultValue: TDefaultFn extends null
    ? null
    : {
        default: ReturnType<NonNullable<TDefaultFn>>;
      };
  directives: TDirectives;
};

/**
 * Creates a variable method for a specific input type.
 * This is used by codegen to generate type-specific variable methods.
 */
export const createVarMethod = <TKind extends InputTypeKind, TTypeName extends string>(kind: TKind, typeName: TTypeName) => {
  return <
    TSchema extends AnyGraphqlSchema,
    const TModifier extends TypeModifier,
    const TDefaultFn extends (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>) | null = null,
    const TDirectives extends AnyConstDirectiveAttachments = {},
  >(
    modifier: TModifier,
    extras?: {
      default?: TDefaultFn & (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>);
      directives?: TDirectives;
    },
  ): VarSpecifier<TKind, TTypeName, TModifier, TDefaultFn, TDirectives> =>
    ({
      kind,
      name: typeName,
      modifier,
      defaultValue: extras?.default ? { default: extras.default() } : null,
      directives: extras?.directives ?? {},
    }) as VarSpecifier<TKind, TTypeName, TModifier, TDefaultFn, TDirectives>;
};

/**
 * Type for a single input type method.
 */
export type InputTypeMethod<TSchema extends AnyGraphqlSchema, TKind extends InputTypeKind, TTypeName extends string> = <
  const TModifier extends TypeModifier,
  const TDefaultFn extends (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>) | null = null,
  const TDirectives extends AnyConstDirectiveAttachments = {},
>(
  modifier: TModifier,
  extras?: {
    default?: TDefaultFn & (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>);
    directives?: TDirectives;
  },
) => VarSpecifier<TKind, TTypeName, TModifier, TDefaultFn, TDirectives>;

/**
 * Type for all input type methods in a schema.
 */
export type InputTypeMethods<TSchema extends AnyGraphqlSchema> = {
  [TName in AllInputTypeNames<TSchema>]: InputTypeMethod<TSchema, InferInputKind<TSchema, TName>, TName>;
};

/**
 * Type for a wrapped variable method that includes the variable name in the result.
 */
type WrappedVarMethod<
  TVarName extends string,
  TSchema extends AnyGraphqlSchema,
  TKind extends InputTypeKind,
  TTypeName extends string,
> = <
  const TModifier extends TypeModifier,
  const TDefaultFn extends (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>) | null = null,
  const TDirectives extends AnyConstDirectiveAttachments = {},
>(
  modifier: TModifier,
  extras?: {
    default?: TDefaultFn & (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>);
    directives?: TDirectives;
  },
) => { [K in TVarName]: VarSpecifier<TKind, TTypeName, TModifier, TDefaultFn, TDirectives> };

/**
 * Type for the variable builder methods for a specific variable name.
 */
export type VarBuilderMethods<TVarName extends string, TSchema extends AnyGraphqlSchema> = {
  [TName in AllInputTypeNames<TSchema>]: WrappedVarMethod<TVarName, TSchema, InferInputKind<TSchema, TName>, TName>;
};

/**
 * Type for the variable builder function.
 */
export type VarBuilder<TSchema extends AnyGraphqlSchema> = {
  <TVarName extends string>(varName: TVarName): VarBuilderMethods<TVarName, TSchema>;
  getName: typeof getVarRefName;
  getValue: typeof getVarRefValue;
  getInner: typeof getVarRefInner;
};

/**
 * Generic input type method that can be called with any modifier.
 */
type AnyInputTypeMethod = (
  modifier: TypeModifier,
  extras?: { default?: () => unknown; directives?: AnyConstDirectiveAttachments },
) => unknown;

/**
 * Creates a variable builder that uses injected input type methods.
 */
export const createVarBuilder = <TSchema extends AnyGraphqlSchema>(
  inputTypeMethods: InputTypeMethods<TSchema>,
): VarBuilder<TSchema> => {
  const varBuilder = <TVarName extends string>(varName: TVarName): VarBuilderMethods<TVarName, TSchema> => {
    const wrappedMethods = {} as VarBuilderMethods<TVarName, TSchema>;

    for (const [typeName, method] of Object.entries(inputTypeMethods) as [string, AnyInputTypeMethod][]) {
      Object.defineProperty(wrappedMethods, typeName, {
        value: ((modifier, extras) => wrapByKey(varName, method(modifier, extras))) satisfies AnyInputTypeMethod,
        writable: false,
        configurable: true,
      });
    }

    return wrappedMethods;
  };

  varBuilder.getName = getVarRefName;
  varBuilder.getValue = getVarRefValue;
  varBuilder.getInner = getVarRefInner;

  return varBuilder as VarBuilder<TSchema>;
};
