/**
 * Ambient interface pattern for schema and adapter type registration.
 *
 * These global interfaces are augmented by generated code to register
 * schema and adapter types by key. This allows type parameters to pass
 * only string keys instead of entire schema types, avoiding TypeScript's
 * type parameter scope loss during deep type expansion.
 *
 * Example usage in generated code:
 * ```typescript
 * declare global {
 *   interface SodaGqlSchemaRegistry {
 *     default: typeof defaultSchema & { _?: never };
 *   }
 *   interface SodaGqlAdapterRegistry {
 *     default: typeof adapter_default & { _?: never };
 *   }
 * }
 * ```
 */

/**
 * Global registry for GraphQL schema types.
 * Augment this interface in generated code to register schemas.
 */
export interface SodaGqlSchemaRegistry {}

/**
 * Global registry for runtime adapter types.
 * Augment this interface in generated code to register adapters.
 */
export interface SodaGqlAdapterRegistry {}

/**
 * Lookup schema type by registry key.
 * Falls back to AnyGraphqlSchema when registry is empty (for type-checking).
 */
export type SchemaByKey<TSchemaKey extends keyof SodaGqlSchemaRegistry | string> =
  keyof SodaGqlSchemaRegistry extends never
    ? import("./schema").AnyGraphqlSchema
    : TSchemaKey extends keyof SodaGqlSchemaRegistry
      ? SodaGqlSchemaRegistry[TSchemaKey]
      : never;

/**
 * Lookup adapter type by registry key.
 * Falls back to AnyGraphqlRuntimeAdapter when registry is empty (for type-checking).
 */
export type AdapterByKey<TAdapterKey extends keyof SodaGqlAdapterRegistry | string> =
  keyof SodaGqlAdapterRegistry extends never
    ? import("../types/runtime").AnyGraphqlRuntimeAdapter
    : TAdapterKey extends keyof SodaGqlAdapterRegistry
      ? SodaGqlAdapterRegistry[TAdapterKey]
      : never;

/**
 * Helper type to ensure a schema key is valid.
 */
export type ValidSchemaKey = keyof SodaGqlSchemaRegistry extends never
  ? string
  : keyof SodaGqlSchemaRegistry;

/**
 * Helper type to ensure an adapter key is valid.
 */
export type ValidAdapterKey = keyof SodaGqlAdapterRegistry extends never
  ? string
  : keyof SodaGqlAdapterRegistry;
