import type {
  AnyFieldSelectionFactory,
  AnyFieldSelectionFactoryReturn,
  FieldSelectionFactories,
  FieldSelectionFactoryObjectReturn,
  FieldSelectionFactoryPrimitiveReturn,
  FieldSelectionFactoryUnionReturn,
  NestedObjectFieldsBuilder,
  NestedUnionFieldsBuilder,
} from "../types/element";
import type { AnyFieldSelection, AnyNestedObject, AnyNestedUnion } from "../types/fragment";
import type { AnyGraphqlSchema, UnionMemberName } from "../types/schema";
import type {
  OutputEnumSpecifier,
  OutputObjectSpecifier,
  OutputScalarSpecifier,
  OutputTypenameSpecifier,
  OutputUnionSpecifier,
} from "../types/type-foundation";
import { mapValues } from "../utils/map-values";
import { wrapByKey } from "../utils/wrap-by-key";
import { appendToPath, getCurrentFieldPath, isListType, withFieldPath } from "./field-path-context";

// Cache is schema-scoped to avoid cross-schema contamination when multiple schemas share type names
type CacheMap = Map<string, Record<string, AnyFieldSelectionFactory>>;

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

export const createFieldFactories = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>(
  schema: TSchema,
  typeName: TTypeName,
): FieldSelectionFactories<TSchema, TTypeName> => {
  const cacheMap = ensureCacheMapBySchema(schema);
  const cached = cacheMap.get(typeName);
  if (cached) {
    return cached as unknown as FieldSelectionFactories<TSchema, TTypeName>;
  }

  const factories = createFieldFactoriesInner(schema, typeName);
  cacheMap.set(typeName, factories as unknown as Record<string, AnyFieldSelectionFactory>);

  return factories;
};

const createFieldFactoriesInner = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>(
  schema: TSchema,
  typeName: TTypeName,
): FieldSelectionFactories<TSchema, TTypeName> => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type ${typeName} is not defined in schema objects`);
  }

  const entries = Object.entries(typeDef.fields).map(([fieldName, type]): [string, AnyFieldSelectionFactory] => {
    const factory: AnyFieldSelectionFactory = <TAlias extends string | null = null>(
      fieldArgs: AnyFieldSelection["args"] | null | void,
      extras?: { alias?: TAlias; directives?: AnyFieldSelection["directives"] },
    ) => {
      const wrap = <T>(value: T) => wrapByKey((extras?.alias ?? fieldName) as TAlias extends null ? string : TAlias, value);

      if (type.kind === "object") {
        type TSelection = AnyFieldSelection & { type: OutputObjectSpecifier };
        const factoryReturn: AnyFieldSelectionFactoryReturn<TAlias> = (<TNested extends AnyNestedObject>(
          nest: NestedObjectFieldsBuilder<TSchema, TSelection["type"]["name"], TNested>,
        ) => {
          // Build new path for this field
          const currentPath = getCurrentFieldPath();
          const newPath = appendToPath(currentPath, {
            field: fieldName,
            parentType: typeName,
            isList: isListType(type.modifier),
          });

          // Run nested builder with updated path context
          const nestedFields = withFieldPath(newPath, () => nest({ f: createFieldFactories(schema, type.name) }));

          return wrap({
            parent: typeName,
            field: fieldName,
            type: type,
            args: fieldArgs ?? {},
            directives: extras?.directives ?? {},
            object: nestedFields,
            union: null,
          } satisfies AnyFieldSelection);
        }) satisfies FieldSelectionFactoryObjectReturn<TSchema, TSelection, TAlias>;

        return factoryReturn;
      }

      if (type.kind === "union") {
        type TSelection = AnyFieldSelection & { type: OutputUnionSpecifier };
        const factoryReturn: AnyFieldSelectionFactoryReturn<TAlias> = (<TNested extends AnyNestedUnion>(
          nest: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TSelection["type"]>, TNested>,
        ) => {
          // Build new path for this field
          const currentPath = getCurrentFieldPath();
          const newPath = appendToPath(currentPath, {
            field: fieldName,
            parentType: typeName,
            isList: isListType(type.modifier),
          });

          // Run nested builders with updated path context
          const nestedUnion = withFieldPath(newPath, () =>
            mapValues(
              nest as Record<string, NestedObjectFieldsBuilder<TSchema, string, AnyNestedObject> | undefined>,
              (builder, memberName) => {
                if (!builder) {
                  throw new Error(`Builder is undefined for member name: ${memberName}`);
                }
                return builder({ f: createFieldFactories(schema, memberName) });
              },
            ),
          ) as TNested;

          return wrap({
            parent: typeName,
            field: fieldName,
            type: type,
            args: fieldArgs ?? {},
            directives: extras?.directives ?? {},
            object: null,
            union: nestedUnion,
          } satisfies AnyFieldSelection);
        }) satisfies FieldSelectionFactoryUnionReturn<TSchema, TSelection, TAlias>;

        return factoryReturn;
      }

      if (type.kind === "scalar" || type.kind === "enum" || type.kind === "typename") {
        type TSelection = AnyFieldSelection & { type: OutputTypenameSpecifier | OutputScalarSpecifier | OutputEnumSpecifier };
        const factoryReturn: AnyFieldSelectionFactoryReturn<TAlias> = wrap({
          parent: typeName,
          field: fieldName,
          type,
          args: fieldArgs ?? {},
          directives: extras?.directives ?? {},
          object: null,
          union: null,
        } satisfies AnyFieldSelection) satisfies FieldSelectionFactoryPrimitiveReturn<TSelection, TAlias>;
        return factoryReturn;
      }

      throw new Error(`Unsupported field type: ${type satisfies never}`);
    };

    return [fieldName, factory] as const;
  });

  const factories: Record<string, AnyFieldSelectionFactory> = Object.fromEntries(entries);

  return factories as unknown as FieldSelectionFactories<TSchema, TTypeName>;
};
