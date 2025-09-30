import type { AnyFieldSelection, AnyFields, AnyNestedObject, AnyNestedUnion } from "../types/fragment";
import type {
  AnyFieldSelectionFactory,
  FieldSelectionFactories,
  FieldSelectionFactoryFieldArguments,
  FieldSelectionFactoryObject,
  FieldSelectionFactoryPrimitive,
  FieldSelectionFactoryUnion,
  NestedObjectFieldsBuilder,
  NestedUnionFieldsBuilder,
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

export const createFieldFactories = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>(
  schema: TSchema,
  typeName: TTypeName,
): FieldSelectionFactories<TSchema, TTypeName> => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type ${typeName} is not defined in schema objects`);
  }

  const entries = Object.entries(typeDef.fields).map(([fieldName, type]): [string, AnyFieldSelectionFactory<TSchema>] => {
    if (type.kind === "object") {
      type TReference = AnyFieldSelection & { type: OutputObjectRef };
      const factory: FieldSelectionFactoryObject<TSchema, TReference> = <TNested extends AnyNestedObject>(
        argsAndDirectives: FieldSelectionFactoryFieldArguments<TReference>,
        objectBuilder: NestedObjectFieldsBuilder<TSchema, TReference["type"]["name"], TNested>,
      ) => {
        const [args, directives = {}] = Array.isArray(argsAndDirectives) ? argsAndDirectives : [argsAndDirectives, {}];
        const nestedFactories = createFieldFactories(schema, type.name);

        return wrapValueByKey(fieldName, {
          parent: typeName,
          field: fieldName,
          type: type,
          args: args ?? {},
          directives,
          object: objectBuilder({
            _: nestedFactories,
            f: nestedFactories,
            fields: nestedFactories,
          }),
          union: null,
        } satisfies AnyFieldSelection);
      };

      return [fieldName, factory] as const;
    }

    if (type.kind === "union") {
      type TReference = AnyFieldSelection & { type: OutputUnionRef };
      const factory: FieldSelectionFactoryUnion<TSchema, TReference> = <TNested extends AnyNestedUnion>(
        argsAndDirectives: FieldSelectionFactoryFieldArguments<TReference>,
        unionBuilder: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TReference["type"]>, TNested>,
      ) => {
        const [args, directives = {}] = Array.isArray(argsAndDirectives) ? argsAndDirectives : [argsAndDirectives, {}];

        return wrapValueByKey(fieldName, {
          parent: typeName,
          field: fieldName,
          type: type,
          args: args ?? {},
          directives,
          object: null,
          union: Object.fromEntries(
            (Object.entries(unionBuilder) as [string, NestedObjectFieldsBuilder<TSchema, string, AnyFields>][]).map(
              ([memberName, builder]) => {
                const nestedFactories = createFieldFactories(schema, memberName);
                return [memberName, builder({ _: nestedFactories, f: nestedFactories, fields: nestedFactories })];
              },
            ),
          ) as TNested,
        } satisfies AnyFieldSelection);
      };

      return [fieldName, factory] as const;
    }

    if (type.kind === "scalar" || type.kind === "enum" || type.kind === "typename") {
      type TReference = AnyFieldSelection & { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef };
      const factory: FieldSelectionFactoryPrimitive<TReference> = (
        argsAndDirectives: FieldSelectionFactoryFieldArguments<TReference>,
      ) => {
        const [args, directives = {}] = Array.isArray(argsAndDirectives) ? argsAndDirectives : [argsAndDirectives, {}];
        return wrapValueByKey(fieldName, {
          parent: typeName,
          field: fieldName,
          type,
          args: args ?? {},
          directives,
          object: null,
          union: null,
        } satisfies AnyFieldSelection);
      };

      return [fieldName, factory] as const;
    }

    throw new Error(`Unsupported field type: ${type satisfies never}`);
  });

  const factories: Record<string, AnyFieldSelectionFactory<TSchema>> = Object.fromEntries(entries);

  return factories as FieldSelectionFactories<TSchema, TTypeName>;
};
