/**
 * Test utilities for schema definition.
 *
 * This file provides a `define` helper for creating mock schema definitions in tests.
 * It was moved from schema-builder.ts to keep the core package focused on production code.
 *
 * @module
 */

import { unsafeOutputType } from "../../src/schema/type-specifier-builder";
import type { EnumDefinition, InputDefinition, ObjectDefinition, UnionDefinition } from "../../src/types/schema";
import { withTypeMeta } from "../../src/utils/type-meta";

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
