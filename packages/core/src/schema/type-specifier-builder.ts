/**
 * Low-level type specifier builders for schema definitions.
 *
 * These are "unsafe" because they bypass type inference from the schema.
 * Prefer using codegen-generated schema types when possible.
 *
 * @module
 */

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

/**
 * Creates input type specifier factory for a given kind.
 * @internal
 */
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
  };

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

/**
 * Creates input type specifiers for schema definitions.
 *
 * Type format: `"TypeName:modifier"` where modifier is `!`, `?`, `![]!`, etc.
 *
 * @example
 * ```typescript
 * const input = {
 *   CreateUserInput: define("CreateUserInput").input({
 *     name: unsafeInputType.scalar("String:!", {}),
 *     age: unsafeInputType.scalar("Int:?", { default: () => 0 }),
 *   }),
 * };
 * ```
 */
export const unsafeInputType = {
  /** Creates a scalar input type specifier. */
  scalar: createUnsafeInputTypeSpecifierFactory("scalar"),
  /** Creates an enum input type specifier. */
  enum: createUnsafeInputTypeSpecifierFactory("enum"),
  /** Creates an input object type specifier. */
  input: createUnsafeInputTypeSpecifierFactory("input"),
};

/**
 * Creates output type specifier factory for a given kind.
 *
 * @param kind - The output type kind ('scalar', 'enum', 'object', 'union', 'typename')
 * @returns Factory function that creates type specifiers with the given kind
 * @internal
 */
const createUnsafeOutputTypeSpecifierFactory = <const TKind extends OutputTypeKind>(kind: TKind) => {
  type UnsafeOutputTypeSpecifier<TName extends string, TModifier extends TypeModifier, TArguments extends InputTypeSpecifiers> = {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    arguments: TArguments;
  };

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

/**
 * Creates output type specifiers for schema definitions.
 *
 * Type format: `"TypeName:modifier"` where modifier is `!`, `?`, `![]!`, etc.
 *
 * @example
 * ```typescript
 * const object = {
 *   User: define("User").object({
 *     id: unsafeOutputType.scalar("ID:!", {}),
 *     name: unsafeOutputType.scalar("String:!", {}),
 *     posts: unsafeOutputType.object("Post:![]!", { arguments: { limit: ... } }),
 *   }),
 * };
 * ```
 */
export const unsafeOutputType = {
  /** Creates a scalar output type specifier. */
  scalar: createUnsafeOutputTypeSpecifierFactory("scalar"),
  /** Creates an enum output type specifier. */
  enum: createUnsafeOutputTypeSpecifierFactory("enum"),
  /** Creates an object output type specifier. */
  object: createUnsafeOutputTypeSpecifierFactory("object"),
  /** Creates a union output type specifier. */
  union: createUnsafeOutputTypeSpecifierFactory("union"),
  /** Creates a __typename output type specifier. */
  typename: createUnsafeOutputTypeSpecifierFactory("typename"),
};
