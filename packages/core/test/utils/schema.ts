/**
 * Test utilities for schema definition.
 *
 * This file provides helpers for creating mock schema definitions in tests.
 * These utilities were moved from core to keep the package focused on production code.
 *
 * @module
 */

import type {
  AnyConstDirectiveAttachments,
  EnumDefinition,
  InputDefinition,
  ObjectDefinition,
  UnionDefinition,
} from "../../src/types/schema";
import {
  type AnyTypeSpecifier,
  type InputTypeKind,
  type InputTypeSpecifiers,
  type ModifiedTypeName,
  type OutputTypeKind,
  parseModifiedTypeName,
  type TypeModifier,
} from "../../src/types/type-foundation";
import type { ConstValue } from "../../src/types/type-foundation/const-value";
import { withTypeMeta } from "../../src/utils/type-meta";

// =============================================================================
// Unsafe Input Type Specifier Builder
// =============================================================================

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

// =============================================================================
// Unsafe Output Type Specifier Builder
// =============================================================================

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

// =============================================================================
// Define Helper
// =============================================================================

/**
 * Creates a type definition builder for enums, inputs, objects, or unions.
 *
 * @param name - The GraphQL type name
 * @returns Builder with `.enum()`, `.input()`, `.object()`, `.union()` methods
 *
 * @example
 * ```typescript
 * const object = {
 *   User: define("User").object({
 *     id: unsafeOutputType.scalar("ID:!", {}),
 *     name: unsafeOutputType.scalar("String:!", {}),
 *   }),
 * };
 * ```
 */
export const define = <const TName extends string>(name: TName) => ({
  /**
   * Defines an enum type with specified values.
   */
  enum: <const TValues extends EnumDefinition<{ name: TName; values: string }>["values"]>(values: TValues) =>
    withTypeMeta({ name, values }) satisfies EnumDefinition<{
      name: TName;
      values: Extract<keyof TValues, string>;
    }>,

  /**
   * Defines an input type with specified fields.
   */
  input: <TFields extends InputDefinition["fields"]>(fields: TFields) =>
    ({
      name,
      fields,
    }) satisfies InputDefinition,

  /**
   * Defines an object type with specified fields.
   * Automatically adds `__typename` field.
   */
  object: <TFields extends ObjectDefinition["fields"]>(fields: TFields) =>
    ({
      name,
      fields: {
        __typename: unsafeOutputType.typename(`${name}:!`, {}),
        ...fields,
      },
    }) satisfies ObjectDefinition,

  /**
   * Defines a union type with specified member types.
   */
  union: <TTypes extends UnionDefinition["types"]>(types: TTypes) =>
    ({
      name,
      types,
    }) satisfies UnionDefinition,
});
