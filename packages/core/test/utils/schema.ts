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
  type DeferredInputSpecifier,
  type DeferredOutputFieldWithArgs,
  type DeferredOutputSpecifier,
  type InputTypeSpecifiers,
  type ModifiedTypeName,
  parseModifiedTypeName,
  type TypeModifier,
} from "../../src/types/type-foundation";
import type { ConstValue } from "../../src/types/type-foundation/const-value";
import { withTypeMeta } from "../../src/utils/type-meta";

/**
 * Map from creatable input type kind to deferred specifier prefix.
 */
const INPUT_KIND_TO_CHAR: Record<"scalar" | "enum" | "input", string> = {
  scalar: "s",
  enum: "e",
  input: "i",
};

/**
 * Map from creatable output type kind to deferred specifier prefix.
 */
const OUTPUT_KIND_TO_CHAR: Record<"scalar" | "enum" | "object" | "union", string> = {
  scalar: "s",
  enum: "e",
  object: "o",
  union: "u",
};

// =============================================================================
// Unsafe Input Type Specifier Builder
// =============================================================================

/**
 * Character prefix for input type kinds used in deferred specifiers.
 */
type InputKindChar<TKind extends "scalar" | "enum" | "input"> = TKind extends "scalar"
  ? "s"
  : TKind extends "enum"
    ? "e"
    : TKind extends "input"
      ? "i"
      : never;

/**
 * Creates input type specifier factory for a given kind.
 * Returns deferred string specifiers in the format: `{kindChar}|{name}|{modifier}[|D]`
 * @internal
 */
const createUnsafeInputTypeSpecifierFactory = <const TKind extends "scalar" | "enum" | "input">(kind: TKind) => {
  const kindChar = INPUT_KIND_TO_CHAR[kind] as InputKindChar<TKind>;

  // Overloads to preserve literal types
  function factory<
    const TName extends string,
    const TModifier extends TypeModifier,
    const TDirectives extends AnyConstDirectiveAttachments = {},
  >(
    type: ModifiedTypeName<[string], TName, TModifier>,
    extras: { default: () => ConstValue; directives?: TDirectives },
  ): `${InputKindChar<TKind>}|${TName}|${TModifier}|D`;

  function factory<
    const TName extends string,
    const TModifier extends TypeModifier,
    const TDirectives extends AnyConstDirectiveAttachments = {},
  >(
    type: ModifiedTypeName<[string], TName, TModifier>,
    extras: { default?: undefined; directives?: TDirectives },
  ): `${InputKindChar<TKind>}|${TName}|${TModifier}`;

  function factory(
    type: ModifiedTypeName<[string], string, TypeModifier>,
    extras: { default?: () => ConstValue; directives?: AnyConstDirectiveAttachments },
  ): DeferredInputSpecifier {
    const { name, modifier } = parseModifiedTypeName(type);
    const defaultSuffix = extras.default ? "|D" : "";
    return `${kindChar}|${name}|${modifier}${defaultSuffix}` as DeferredInputSpecifier;
  }

  return factory;
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
 * Map from output kind to deferred specifier prefix character.
 */
type OutputKindChar<TKind extends "scalar" | "enum" | "object" | "union"> = TKind extends "scalar"
  ? "s"
  : TKind extends "enum"
    ? "e"
    : TKind extends "object"
      ? "o"
      : TKind extends "union"
        ? "u"
        : never;

/**
 * Creates output type specifier factory for a given kind.
 * Returns object format: `{ spec: "{kindChar}|{name}|{modifier}", arguments: {...} }`
 *
 * The return type preserves the kind, name, and modifier at the type level.
 *
 * @param kind - The output type kind ('scalar', 'enum', 'object', 'union')
 * @returns Factory function that creates deferred type specifiers
 * @internal
 */
const createUnsafeOutputTypeSpecifierFactory = <const TKind extends "scalar" | "enum" | "object" | "union">(kind: TKind) => {
  const kindChar = OUTPUT_KIND_TO_CHAR[kind];

  // Returns object format with spec and arguments
  function factory<
    const TName extends string,
    const TModifier extends TypeModifier,
    const TArguments extends InputTypeSpecifiers = {},
  >(
    type: ModifiedTypeName<[string], TName, TModifier>,
    extras: { arguments?: TArguments },
  ): { readonly spec: `${OutputKindChar<TKind>}|${TName}|${TModifier}`; readonly arguments: TArguments } {
    const { name, modifier } = parseModifiedTypeName(type);
    const spec = `${kindChar}|${name}|${modifier}` as `${OutputKindChar<TKind>}|${TName}|${TModifier}`;
    const args = (extras.arguments ?? {}) as TArguments;

    return { spec, arguments: args };
  }

  return factory;
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
/**
 * Creates a __typename specifier.
 * __typename is a special scalar field that returns the object type name as a string literal.
 * We use "s|{TypeName}|!" format since typename is always a non-null string.
 * Returns object format with empty arguments.
 */
const createTypenameSpecifier = <const TName extends string, const TModifier extends TypeModifier>(
  type: ModifiedTypeName<[string], TName, TModifier>,
  _extras: Record<string, never>,
): DeferredOutputFieldWithArgs => {
  const { name, modifier } = parseModifiedTypeName(type);
  // __typename is effectively a scalar that returns the type name
  return { spec: `s|${name}|${modifier}` as DeferredOutputSpecifier, arguments: {} };
};

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
  typename: createTypenameSpecifier,
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
