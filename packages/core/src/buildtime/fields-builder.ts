import type { AnyFieldSelection, AnyNestedObject, AnyNestedUnion } from "../types/fragment";
import {
  type AnyFieldSelectionFactory,
  type AnyFieldSelectionFactoryReturn,
  type FieldSelectionFactories,
  type FieldSelectionFactoryObjectReturn,
  type FieldSelectionFactoryPrimitiveReturn,
  type FieldSelectionFactoryUnionReturn,
  mergeFields,
  type NestedObjectFieldsBuilder,
  type NestedUnionFieldsBuilder,
} from "../types/operation";
import type {
  AnyGraphqlSchema,
  OutputEnumRef,
  OutputObjectRef,
  OutputScalarRef,
  OutputTypenameRef,
  OutputUnionRef,
  UnionMemberName,
} from "../types/schema";
import { wrapValueByKey } from "../types/shared/utility";

const cache = new Map<string, Record<string, AnyFieldSelectionFactory>>();

export const createFieldFactories = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>(
  schema: TSchema,
  typeName: TTypeName,
): FieldSelectionFactories<TSchema, TTypeName> => {
  const cached = cache.get(typeName);
  if (cached) {
    return cached as unknown as FieldSelectionFactories<TSchema, TTypeName>;
  }

  const factories = createFieldFactoriesInner(schema, typeName);
  cache.set(typeName, factories as unknown as Record<string, AnyFieldSelectionFactory>);

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
      const wrap = <T>(value: T) => wrapValueByKey((extras?.alias ?? fieldName) as TAlias extends null ? string : TAlias, value);

      if (type.kind === "object") {
        type TSelection = AnyFieldSelection & { type: OutputObjectRef };
        const factoryReturn: AnyFieldSelectionFactoryReturn<TAlias> = (<TNested extends AnyNestedObject[]>(
          nest: NestedObjectFieldsBuilder<TSchema, TSelection["type"]["name"], TNested>,
        ) =>
          wrap({
            parent: typeName,
            field: fieldName,
            type: type,
            args: fieldArgs ?? {},
            directives: extras?.directives ?? {},
            object: mergeFields(nest({ f: createFieldFactories(schema, type.name) })),
            union: null,
          } satisfies AnyFieldSelection)) satisfies FieldSelectionFactoryObjectReturn<TSchema, TSelection, TAlias>;

        return factoryReturn;
      }

      if (type.kind === "union") {
        type TSelection = AnyFieldSelection & { type: OutputUnionRef };
        const factoryReturn: AnyFieldSelectionFactoryReturn<TAlias> = (<TNested extends AnyNestedUnion>(
          nest: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TSelection["type"]>, TNested>,
        ) =>
          wrap({
            parent: typeName,
            field: fieldName,
            type: type,
            args: fieldArgs ?? {},
            directives: extras?.directives ?? {},
            object: null,
            union: Object.fromEntries(
              (Object.entries(nest) as [string, NestedObjectFieldsBuilder<TSchema, string, AnyNestedObject[]>][]).map(
                ([memberName, builder]) => {
                  const f = createFieldFactories(schema, memberName);
                  return [memberName, mergeFields(builder({ f }))];
                },
              ),
            ) as TNested,
          } satisfies AnyFieldSelection)) satisfies FieldSelectionFactoryUnionReturn<TSchema, TSelection, TAlias>;

        return factoryReturn;
      }

      if (type.kind === "scalar" || type.kind === "enum" || type.kind === "typename") {
        type TSelection = AnyFieldSelection & { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef };
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
