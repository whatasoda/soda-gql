/**
 * Creates field selection factories for building GraphQL selections.
 * @module
 */

import type { AnyFieldSelection, AnyFieldsExtended, AnyNestedObject, AnyNestedUnion } from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema/schema";
import type { DeferredOutputField } from "../types/type-foundation";
import type { AnyDirectiveRef } from "../types/type-foundation/directive-ref";
import type { AnyVarRef } from "../types/type-foundation/var-ref";
import { parseOutputField } from "../utils/deferred-specifier-parser";
import { wrapByKey } from "../utils/wrap-by-key";
import { appendToPath, getCurrentFieldPath, isListType, withFieldPath } from "./field-path-context";

// ============================================================================
// Relocated builder contract types (type-erased from types/element/fields-builder.ts)
// ============================================================================

/** Builder callback for top-level field selections (has $ variable access) */
export type FieldsBuilder<TFields extends AnyFieldsExtended = AnyFieldsExtended> = (tools: {
  f: FieldAccessorFunction;
  $: Readonly<Record<string, AnyVarRef>>;
}) => TFields;

/** Builder callback for nested object field selections (no $ access) */
export type NestedObjectFieldsBuilder<TFields extends AnyFieldsExtended = AnyFieldsExtended> = (tools: {
  f: FieldAccessorFunction;
}) => TFields;

/** Builder for union type selections with per-member field definitions */
export type NestedUnionFieldsBuilder = {
  [typeName: string]: NestedObjectFieldsBuilder | undefined;
} & { __typename?: true };

// ============================================================================
// FieldAccessorFunction
// ============================================================================

/**
 * Type-erased return from field accessor.
 * The actual runtime shape is a function: for scalar/enum fields it takes no args,
 * for object fields it takes a NestedObjectFieldsBuilder, for union fields a NestedUnionFieldsBuilder.
 * This type preserves enough structure so that nested `({ f })` callbacks infer `f` properly.
 */
/**
 * Type-erased return from field accessor.
 * For object fields: accepts NestedObjectFieldsBuilder (typed `{ f }` callback).
 * For union fields and scalar thunks: uses catch-all signature.
 */
// biome-ignore lint/suspicious/noExplicitAny: Type-erased field accessor return — actual shapes vary by field kind
type AnyFieldAccessorReturn = ((nest: NestedObjectFieldsBuilder) => any) & ((...args: any[]) => any);

/** Function-call field accessor: f("fieldName", args, extras) */
export type FieldAccessorFunction = (
  fieldName: string,
  fieldArgs?: AnyFieldSelection["args"] | null | void,
  extras?: { alias?: string; directives?: AnyDirectiveRef[] },
) => AnyFieldAccessorReturn;

// ============================================================================
// Cache and factory
// ============================================================================

/**
 * Cache map type for field factories.
 * Schema-scoped to avoid cross-schema contamination.
 * @internal
 */
type CacheMap = Map<string, FieldAccessorFunction>;

const cacheMapBySchema = new WeakMap<AnyGraphqlSchema, CacheMap>();
const ensureCacheMapBySchema = (schema: AnyGraphqlSchema) => {
  const cachedCacheMap = cacheMapBySchema.get(schema);
  if (cachedCacheMap) {
    return cachedCacheMap;
  }

  const cacheMap: CacheMap = new Map();
  cacheMapBySchema.set(schema, cacheMap);
  return cacheMap;
};

/**
 * Creates a field accessor function for a given object type.
 *
 * Returns a function f("fieldName", args, extras) for building field selections.
 * Factories are cached per schema+type to avoid recreation.
 *
 * @param schema - The GraphQL schema definition
 * @param typeName - The object type name to create factories for
 * @returns FieldAccessorFunction for building field selections
 *
 * @internal Used by operation and fragment composers
 */
export const createFieldFactories = <TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
  typeName: string,
): FieldAccessorFunction => {
  const cacheMap = ensureCacheMapBySchema(schema);
  const cached = cacheMap.get(typeName);
  if (cached) {
    return cached;
  }

  const factory = createFieldFactoriesInner(schema, typeName);
  cacheMap.set(typeName, factory);

  return factory;
};

const createFieldFactoriesInner = (schema: AnyGraphqlSchema, typeName: string): FieldAccessorFunction => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type ${typeName} is not defined in schema objects`);
  }

  return (fieldName, fieldArgs, extras) => {
    // __typename is an implicit introspection field
    if (fieldName === "__typename") {
      const wrap = <T>(value: T) => wrapByKey(extras?.alias ?? fieldName, value);
      return (() =>
        wrap({
          parent: typeName,
          field: fieldName,
          type: "s|String|!",
          args: {},
          directives: extras?.directives ?? [],
          object: null,
          union: null,
        })) as unknown as AnyFieldAccessorReturn;
    }

    // Runtime duck-typing: codegen may emit string or { spec, arguments }
    const fieldDef = typeDef.fields[fieldName];
    if (!fieldDef) {
      throw new Error(`Field "${fieldName}" is not defined on type "${typeName}"`);
    }

    const typeSpecifier = typeof fieldDef === "string" ? fieldDef : (fieldDef as { spec: string }).spec;
    const parsedType = parseOutputField(typeSpecifier as DeferredOutputField);

    const wrap = <T>(value: T) => wrapByKey(extras?.alias ?? fieldName, value);
    const directives = extras?.directives ?? [];

    if (parsedType.kind === "object") {
      const factoryReturn = (<TNested extends AnyNestedObject>(nest: NestedObjectFieldsBuilder<TNested & AnyFieldsExtended>) => {
        // Build new path for this field
        const currentPath = getCurrentFieldPath();
        const newPath = appendToPath(currentPath, {
          field: fieldName,
          parentType: typeName,
          isList: isListType(parsedType.modifier),
        });

        // Run nested builder with updated path context
        const nestedFields = withFieldPath(newPath, () => nest({ f: createFieldFactories(schema, parsedType.name) }));

        return wrap({
          parent: typeName,
          field: fieldName,
          type: typeSpecifier,
          args: fieldArgs ?? {},
          directives,
          object: nestedFields,
          union: null,
        });
      }) as unknown as AnyFieldAccessorReturn;

      return factoryReturn;
    }

    if (parsedType.kind === "union") {
      const factoryReturn = (<TNested extends AnyNestedUnion>(nest: NestedUnionFieldsBuilder & TNested) => {
        // Build new path for this field
        const currentPath = getCurrentFieldPath();
        const newPath = appendToPath(currentPath, {
          field: fieldName,
          parentType: typeName,
          isList: isListType(parsedType.modifier),
        });

        // Extract __typename flag before processing
        const typenameFlag = (nest as { __typename?: true }).__typename;

        // Run nested builders with updated path context, filtering out __typename
        const selections = withFieldPath(newPath, () => {
          const result: Record<string, unknown> = {};
          for (const [memberName, builder] of Object.entries(nest)) {
            if (memberName === "__typename") {
              continue; // Skip the flag, stored separately
            }
            // Skip non-function values (shouldn't happen but guard for safety)
            if (typeof builder !== "function") {
              continue;
            }
            result[memberName] = (builder as NestedObjectFieldsBuilder)({
              f: createFieldFactories(schema, memberName),
            });
          }
          return result;
        });

        return wrap({
          parent: typeName,
          field: fieldName,
          type: typeSpecifier,
          args: fieldArgs ?? {},
          directives,
          object: null,
          union: {
            selections,
            __typename: typenameFlag === true,
          },
        });
      }) as unknown as AnyFieldAccessorReturn;

      return factoryReturn;
    }

    if (parsedType.kind === "scalar" || parsedType.kind === "enum") {
      const factoryReturn = (() =>
        wrap({
          parent: typeName,
          field: fieldName,
          type: typeSpecifier,
          args: fieldArgs ?? {},
          directives,
          object: null,
          union: null,
        })) as unknown as AnyFieldAccessorReturn;
      return factoryReturn;
    }

    throw new Error(`Unsupported field type kind: ${parsedType.kind}`);
  };
};
