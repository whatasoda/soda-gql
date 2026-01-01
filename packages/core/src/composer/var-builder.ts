import type {
  AllInputTypeNames,
  AnyConstDirectiveAttachments,
  AnyGraphqlSchema,
  ConstAssignableInputValue,
  InferInputKind,
  ResolveInputProfileFromMeta,
} from "../types/schema";
import type { InputTypeKind, TypeModifier, TypeProfile } from "../types/type-foundation";
import type { AnyVarRefBrand, VarRef } from "../types/type-foundation/var-ref";
import { wrapByKey } from "../utils/wrap-by-key";
import type { SelectableProxy } from "./var-ref-tools";
import { getNameAt, getValueAt, getVariablePath, getVarRefInner, getVarRefName, getVarRefValue } from "./var-ref-tools";

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
 *
 * @deprecated Use createVarMethodFactory instead for proper type inference with nested input objects.
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
 * Creates a factory function for generating schema-scoped variable methods.
 * This ensures proper type inference for nested input objects by binding the schema type upfront.
 *
 * @example
 * ```typescript
 * const createMethod = createVarMethodFactory<typeof schema>();
 * const inputTypeMethods = {
 *   Boolean: createMethod("scalar", "Boolean"),
 *   user_bool_exp: createMethod("input", "user_bool_exp"),
 * } satisfies InputTypeMethods<typeof schema>;
 * ```
 */
export const createVarMethodFactory = <TSchema extends AnyGraphqlSchema>() => {
  return <TKind extends InputTypeKind, TTypeName extends AllInputTypeNames<TSchema>>(
    kind: TKind,
    typeName: TTypeName,
  ): InputTypeMethod<TSchema, TKind, TTypeName> => {
    return ((modifier, extras) => ({
      kind,
      name: typeName,
      modifier,
      defaultValue: extras?.default ? { default: extras.default() } : null,
      directives: extras?.directives ?? {},
    })) as InputTypeMethod<TSchema, TKind, TTypeName>;
  };
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
  getNameAt: SchemaAwareGetNameAt<TSchema>;
  getValueAt: SchemaAwareGetValueAt<TSchema>;
  getVariablePath: typeof getVariablePath;
};

// ============================================================================
// Schema-aware Type Resolution for VarRef Meta
// ============================================================================

/**
 * Resolves the TypeScript type from VarRef meta using schema.
 * This is used for getValueAt/getNameAt with type structure resolution.
 */
export type ResolveTypeFromMeta<TSchema extends AnyGraphqlSchema, TMeta extends AnyVarRefBrand> = TypeProfile.Type<
  ResolveInputProfileFromMeta<TSchema, TMeta["typeName"], TMeta["kind"], "!">
>;

/**
 * Schema-aware getValueAt type.
 * Resolves type structure from schema using typeName + kind.
 */
export type SchemaAwareGetValueAt<TSchema extends AnyGraphqlSchema> = <T extends AnyVarRefBrand, U>(
  varRef: VarRef<T>,
  selector: (proxy: SelectableProxy<ResolveTypeFromMeta<TSchema, T>>) => U,
) => U;

/**
 * Schema-aware getNameAt type.
 * Resolves type structure from schema using typeName + kind.
 */
export type SchemaAwareGetNameAt<TSchema extends AnyGraphqlSchema> = <T extends AnyVarRefBrand, U>(
  varRef: VarRef<T>,
  selector: (proxy: ResolveTypeFromMeta<TSchema, T>) => U,
) => string;

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
  varBuilder.getNameAt = getNameAt;
  varBuilder.getValueAt = getValueAt;
  varBuilder.getVariablePath = getVariablePath;

  return varBuilder as VarBuilder<TSchema>;
};
