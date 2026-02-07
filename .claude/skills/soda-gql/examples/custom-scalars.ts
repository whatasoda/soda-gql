/**
 * Custom Scalars Example
 *
 * Defining custom scalar types in the inject module.
 * This file shows the structure of a typical inject file.
 */
import { defineScalar } from "@soda-gql/core";

// Custom types for enhanced type safety
type UUID = string & { readonly __brand: "UUID" };
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Export as 'scalar' - this is required by the generated GraphQL system.
 * Each scalar maps GraphQL types to TypeScript types.
 */
export const scalar = {
  // Built-in GraphQL scalars
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),

  // Date/Time scalars
  // Input: ISO string, Output: Date object
  ...defineScalar<"DateTime", string, Date>("DateTime"),
  ...defineScalar<"Date", string, Date>("Date"),
  ...defineScalar<"Time", string, string>("Time"),
  ...defineScalar<"Timestamp", number, Date>("Timestamp"),

  // Identifier scalars with branded types
  ...defineScalar<"UUID", string, UUID>("UUID"),

  // Data scalars
  ...defineScalar<"JSON", JsonValue, JsonValue>("JSON"),
  ...defineScalar<"JSONObject", Record<string, unknown>, Record<string, unknown>>(
    "JSONObject"
  ),

  // Network scalars
  ...defineScalar<"URL", string, URL>("URL"),
  ...defineScalar<"Email", string, string>("Email"),

  // Number scalars
  ...defineScalar<"BigInt", string, bigint>("BigInt"),
  ...defineScalar<"Decimal", string, number>("Decimal"),

  // File upload
  ...defineScalar<"Upload", File, never>("Upload"),

  // Special scalars
  ...defineScalar<"Void", never, null>("Void"),
} as const;

/**
 * Alternative: Callback syntax for more control
 */
export const scalarWithCallback = {
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),
    output: type<Date>(),
    directives: {},
  })),

  ...defineScalar("Money", ({ type }) => ({
    input: type<number>(),
    output: type<{ amount: number; currency: string }>(),
    directives: {},
  })),
} as const;
