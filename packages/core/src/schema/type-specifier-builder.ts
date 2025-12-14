import type { AnyConstDirectiveAttachments } from "../types/schema";
import {
  type AnyTypeSpecifier,
  type InputTypeKind,
  type InputTypeSpecifiers,
  type ModifiedTypeName,
  type OutputTypeKind,
  parseModifiedTypeName,
  type TypeModifier,
} from "../types/type-foundation";
import type { ConstValue } from "../types/type-foundation/const-value";

const createUnsafeInputTypeSpecifierFactory = <const TKind extends InputTypeKind>(kind: TKind) => {
  type UnsafeInputTypeSpecifier<
    TName extends string,
    TModifier extends TypeModifier,
    TDefaultFactory extends (() => ConstValue) | null,
    TDirectives extends AnyConstDirectiveAttachments,
  > = {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    defaultValue: TDefaultFactory extends null ? null : { default: ReturnType<NonNullable<TDefaultFactory>> };
    directives: TDirectives;
  } & {};

  return <
    const TName extends string,
    const TModifier extends TypeModifier,
    const TDefaultFactory extends (() => ConstValue) | null = null,
    const TDirectives extends AnyConstDirectiveAttachments = {},
  >(
    type: ModifiedTypeName<[string], TName, TModifier>,
    extras: {
      default?: TDefaultFactory;
      directives?: TDirectives;
    },
  ): UnsafeInputTypeSpecifier<TName, TModifier, TDefaultFactory, TDirectives> =>
    ({
      kind,
      ...parseModifiedTypeName(type),
      defaultValue: extras.default ? { default: extras.default() } : null,
    }) satisfies AnyTypeSpecifier as UnsafeInputTypeSpecifier<TName, TModifier, TDefaultFactory, TDirectives>;
};

export const unsafeInputType = {
  scalar: createUnsafeInputTypeSpecifierFactory("scalar"),
  enum: createUnsafeInputTypeSpecifierFactory("enum"),
  input: createUnsafeInputTypeSpecifierFactory("input"),
};

const createUnsafeOutputTypeSpecifierFactory = <const TKind extends OutputTypeKind>(kind: TKind) => {
  type UnsafeOutputTypeSpecifier<TName extends string, TModifier extends TypeModifier, TArguments extends InputTypeSpecifiers> = {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    arguments: TArguments;
  } & {};

  return <const TName extends string, const TModifier extends TypeModifier, const TArguments extends InputTypeSpecifiers = {}>(
    type: ModifiedTypeName<[string], TName, TModifier>,
    extras: {
      arguments?: TArguments;
    },
  ): UnsafeOutputTypeSpecifier<TName, TModifier, InputTypeSpecifiers extends TArguments ? {} : TArguments> =>
    ({
      kind,
      ...parseModifiedTypeName(type),
      arguments: extras.arguments ?? ({} as TArguments),
    }) satisfies AnyTypeSpecifier as UnsafeOutputTypeSpecifier<
      TName,
      TModifier,
      InputTypeSpecifiers extends TArguments ? {} : TArguments
    >;
};

export const unsafeOutputType = {
  scalar: createUnsafeOutputTypeSpecifierFactory("scalar"),
  enum: createUnsafeOutputTypeSpecifierFactory("enum"),
  object: createUnsafeOutputTypeSpecifierFactory("object"),
  union: createUnsafeOutputTypeSpecifierFactory("union"),
  typename: createUnsafeOutputTypeSpecifierFactory("typename"),
};
