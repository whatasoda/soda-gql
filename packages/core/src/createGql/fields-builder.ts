import {
  type AnyFieldReference,
  type AnyFieldReferenceFactory,
  type AnyFields,
  type AnyGraphqlSchema,
  type AnyNestedObject,
  type AnyNestedUnion,
  type EnumRef,
  type FieldReferenceFactories,
  type FieldReferenceFactoryFieldArguments,
  type FieldReferenceFactoryObject,
  type FieldReferenceFactoryScalar,
  type FieldReferenceFactoryUnion,
  type NestedObjectFieldsBuilder,
  type NestedUnionFieldsBuilder,
  type ObjectTypeRef,
  type ScalarRef,
  type TypenameRef,
  type UnionMemberName,
  type UnionTypeRef,
  wrapValueByKey,
} from "../types";

export const createFieldFactories = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>(
  schema: TSchema,
  typeName: TTypeName,
): FieldReferenceFactories<TSchema, TTypeName> => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type ${typeName} is not defined in schema objects`);
  }

  const entries = Object.entries(typeDef.fields).map(([fieldName, { type }]): [string, AnyFieldReferenceFactory<TSchema>] => {
    if (type.kind === "object") {
      type TReference = AnyFieldReference & { type: ObjectTypeRef };
      const factory: FieldReferenceFactoryObject<TSchema, TReference> = <TNested extends AnyNestedObject>(
        argsAndDirectives: FieldReferenceFactoryFieldArguments<TReference>,
        objectBuilder: NestedObjectFieldsBuilder<TSchema, TReference["type"]["name"], TNested>,
      ) => {
        const [args = {}, directives = {}] = Array.isArray(argsAndDirectives) ? argsAndDirectives : [argsAndDirectives, {}];
        const nestedFactories = createFieldFactories(schema, type.name);

        return wrapValueByKey(fieldName, {
          parent: typeName,
          field: fieldName,
          type: type,
          args,
          directives,
          object: objectBuilder({
            _: nestedFactories,
            f: nestedFactories,
            fields: nestedFactories,
          }),
          union: null,
        } satisfies AnyFieldReference);
      };

      return [fieldName, factory] as const;
    }

    if (type.kind === "union") {
      type TReference = AnyFieldReference & { type: UnionTypeRef };
      const factory: FieldReferenceFactoryUnion<TSchema, TReference> = <TNested extends AnyNestedUnion>(
        argsAndDirectives: FieldReferenceFactoryFieldArguments<TReference>,
        unionBuilder: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TReference["type"]>, TNested>,
      ) => {
        const [args = {}, directives = {}] = Array.isArray(argsAndDirectives) ? argsAndDirectives : [argsAndDirectives, {}];

        return wrapValueByKey(fieldName, {
          parent: typeName,
          field: fieldName,
          type: type,
          args,
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
        } satisfies AnyFieldReference);
      };

      return [fieldName, factory] as const;
    }

    if (type.kind === "scalar" || type.kind === "enum" || type.kind === "typename") {
      type TReference = AnyFieldReference & { type: TypenameRef | ScalarRef | EnumRef };
      const factory: FieldReferenceFactoryScalar<TReference> = (
        argsAndDirectives: FieldReferenceFactoryFieldArguments<TReference>,
      ) => {
        const [args = {}, directives = {}] = Array.isArray(argsAndDirectives) ? argsAndDirectives : [argsAndDirectives, {}];
        return wrapValueByKey(fieldName, {
          parent: typeName,
          field: fieldName,
          type,
          args,
          directives,
          object: null,
          union: null,
        } satisfies AnyFieldReference);
      };

      return [fieldName, factory] as const;
    }

    throw new Error(`Unsupported field type: ${type satisfies never}`);
  });

  const factories: Record<string, AnyFieldReferenceFactory<TSchema>> = Object.fromEntries(entries);

  return factories as FieldReferenceFactories<TSchema, TTypeName>;
};
