/**
 * Schema definition builders for GraphQL types.
 * @module
 */

import type {
  EnumDefinition,
  InputDefinition,
  ObjectDefinition,
  OperationRoots,
  ScalarDefinition,
  UnionDefinition,
} from "../types/schema";
import { withTypeMeta } from "../utils/type-meta";
import { wrapByKey } from "../utils/wrap-by-key";
import { unsafeOutputType } from "./type-specifier-builder";

/**
 * Defines a custom scalar type with input/output type mappings.
 *
 * @template TName - The scalar name (e.g., "DateTime", "JSON")
 * @template TInput - TypeScript type for input values
 * @template TOutput - TypeScript type for output values
 *
 * @example
 * ```typescript
 * const scalar = {
 *   ...defineScalar<"DateTime", string, Date>("DateTime"),
 *   ...defineScalar<"JSON", unknown, unknown>("JSON"),
 * };
 * ```
 */
export const defineScalar = <const TName extends string, TInput, TOutput>(name: NoInfer<TName>) =>
  wrapByKey(
    name,
    withTypeMeta({ name }) satisfies ScalarDefinition<{
      name: TName;
      input: TInput;
      output: TOutput;
    }>,
  );

/**
 * Creates an enum type definition for codegen.
 * Uses function overload to declare return type explicitly,
 * reducing structural type comparison cost.
 *
 * @template TName - The enum name
 * @template TValues - Union type of enum values
 * @param name - The enum name (runtime value)
 * @param values - Object with enum values as keys
 * @returns EnumDefinition with proper type metadata
 *
 * @example
 * ```typescript
 * const status = enumType<"Status", "ACTIVE" | "INACTIVE">(
 *   "Status",
 *   { ACTIVE: true, INACTIVE: true }
 * );
 * ```
 */
export function enumType<TName extends string, TValues extends string>(
  name: TName,
  values: { readonly [_ in TValues]: true },
): EnumDefinition<{ name: TName; values: TValues }>;
export function enumType<TName extends string, TValues extends string>(
  name: TName,
  values: { readonly [_ in TValues]: true },
): EnumDefinition<{ name: TName; values: TValues }> {
  return withTypeMeta({ name, values }) as EnumDefinition<{ name: TName; values: TValues }>;
}

/**
 * Creates an input type definition for codegen.
 *
 * @param name - The input type name
 * @param fields - The input fields
 * @returns InputDefinition
 *
 * @example
 * ```typescript
 * const userInput = inputType("UserInput", {
 *   name: unsafeInputType.scalar("String:!", {}),
 *   age: unsafeInputType.scalar("Int:?", {}),
 * });
 * ```
 */
export const inputType = <TFields extends InputDefinition["fields"]>(name: string, fields: TFields): InputDefinition => ({
  name,
  fields,
});

/**
 * Creates an object type definition for codegen.
 *
 * @param name - The object type name
 * @param fields - The object fields (including __typename)
 * @returns ObjectDefinition
 *
 * @example
 * ```typescript
 * const user = objectType("User", {
 *   __typename: unsafeOutputType.typename("User:!", {}),
 *   id: unsafeOutputType.scalar("ID:!", {}),
 *   name: unsafeOutputType.scalar("String:!", {}),
 * });
 * ```
 */
export const objectType = <TFields extends ObjectDefinition["fields"]>(name: string, fields: TFields): ObjectDefinition => ({
  name,
  fields,
});

/**
 * Creates a union type definition for codegen.
 *
 * @param name - The union type name
 * @param types - Object with member type names as keys
 * @returns UnionDefinition
 *
 * @example
 * ```typescript
 * const searchResult = unionType("SearchResult", { User: true, Post: true });
 * ```
 */
export const unionType = <TTypes extends UnionDefinition["types"]>(name: string, types: TTypes): UnionDefinition => ({
  name,
  types,
});

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

/**
 * Defines the root operation types for the schema.
 *
 * @example
 * ```typescript
 * const operations = defineOperationRoots({
 *   query: "Query",
 *   mutation: "Mutation",
 *   subscription: null, // or "Subscription"
 * });
 * ```
 */
export const defineOperationRoots = <const TOperationRoots extends OperationRoots>(operationRoots: TOperationRoots) =>
  operationRoots;
