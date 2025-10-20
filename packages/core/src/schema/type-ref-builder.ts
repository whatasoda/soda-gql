import {
  type AnyConstDirectiveAttachments,
  type AnyTypeSpecifier,
  type InputTypeKind,
  type InputTypeSpecifiers,
  type ModifiedTypeName,
  type OutputTypeKind,
  parseModifiedTypeName,
  type TypeModifier,
} from "../types/schema";
import type { ConstValue } from "../types/schema/const-value";

const createUnsafeInputRefFactory = <const TKind extends InputTypeKind>(kind: TKind) => {
  type UnsafeInputRef<
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
  };

  return <
    const TName extends string,
    const TModifier extends TypeModifier,
    const TDefaultFactory extends (() => ConstValue) | null = null,
    const TDirectives extends AnyConstDirectiveAttachments = {},
  >(
    type: ModifiedTypeName<string, TName, TModifier>,
    extras: {
      default?: TDefaultFactory;
      directives?: TDirectives;
    },
  ): UnsafeInputRef<TName, TModifier, TDefaultFactory, TDirectives> =>
    ({
      kind,
      ...parseModifiedTypeName(type),
      defaultValue: extras.default ? { default: extras.default() } : null,
      directives: extras.directives ?? ({} as TDirectives),
    }) satisfies AnyTypeSpecifier as UnsafeInputRef<TName, TModifier, TDefaultFactory, TDirectives>;
};

export const unsafeInputRef = {
  scalar: createUnsafeInputRefFactory("scalar"),
  enum: createUnsafeInputRefFactory("enum"),
  input: createUnsafeInputRefFactory("input"),
};

const createUnsafeOutputRefFactory = <const TKind extends OutputTypeKind>(kind: TKind) => {
  type UnsafeOutputRef<
    TName extends string,
    TModifier extends TypeModifier,
    TArguments extends InputTypeSpecifiers,
    TDirectives extends AnyConstDirectiveAttachments,
  > = {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    arguments: TArguments;
    directives: TDirectives;
  };

  return <
    const TName extends string,
    const TModifier extends TypeModifier,
    const TArguments extends InputTypeSpecifiers = {},
    const TDirectives extends AnyConstDirectiveAttachments = {},
  >(
    type: ModifiedTypeName<string, TName, TModifier>,
    extras: {
      arguments?: TArguments;
      directives?: TDirectives;
    },
  ): UnsafeOutputRef<TName, TModifier, InputTypeSpecifiers extends TArguments ? {} : TArguments, TDirectives> =>
    ({
      kind,
      ...parseModifiedTypeName(type),
      arguments: extras.arguments ?? ({} as TArguments),
      directives: extras.directives ?? ({} as TDirectives),
    }) satisfies AnyTypeSpecifier as UnsafeOutputRef<
      TName,
      TModifier,
      InputTypeSpecifiers extends TArguments ? {} : TArguments,
      TDirectives
    >;
};

export const unsafeOutputRef = {
  scalar: createUnsafeOutputRefFactory("scalar"),
  enum: createUnsafeOutputRefFactory("enum"),
  object: createUnsafeOutputRefFactory("object"),
  union: createUnsafeOutputRefFactory("union"),
  typename: createUnsafeOutputRefFactory("typename"),
};
