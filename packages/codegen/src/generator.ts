import type { GraphQLArgument, GraphQLField, GraphQLNamedType, GraphQLSchema, GraphQLType } from "graphql";
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";

const builtinScalars = new Map<string, string>([
  ["ID", "string"],
  ["String", "string"],
  ["Int", "number"],
  ["Float", "number"],
  ["Boolean", "boolean"],
]);

const formatForGraphqlType = (type: GraphQLType): string => {
  if (isNonNullType(type)) {
    const innerFormat = formatForGraphqlType(type.ofType);
    return innerFormat.startsWith("?") ? innerFormat.replace("?", "!") : `!${innerFormat}`;
  }

  if (isListType(type)) {
    const inner = type.ofType;
    const itemFlag = isNonNullType(inner) ? "!" : "?";
    return `?[]${itemFlag}`;
  }

  return "?";
};

const unwrapNamedType = (type: GraphQLType): GraphQLNamedType => {
  let current: GraphQLType = type;
  while (isNonNullType(current) || isListType(current)) {
    current = (current as { ofType: GraphQLType }).ofType;
  }
  return current as GraphQLNamedType;
};

const renderFieldType = (type: GraphQLType): string => {
  const format = formatForGraphqlType(type);
  const named = unwrapNamedType(type);

  if (isScalarType(named)) {
    return `unsafeRef.scalar("${named.name}", "${format}")`;
  }

  if (isEnumType(named)) {
    return `unsafeRef.enum("${named.name}", "${format}")`;
  }

  if (isUnionType(named)) {
    return `unsafeRef.union("${named.name}", "${format}")`;
  }

  if (isInputObjectType(named)) {
    return `unsafeRef.input("${named.name}", "${format}")`;
  }

  return `unsafeRef.object("${named.name}", "${format}")`;
};

const renderArgumentMap = (args: readonly GraphQLArgument[]): string => {
  const entries = args.map((arg) => `${arg.name}: ${renderFieldType(arg.type)}`);

  if (entries.length === 0) {
    return "{}";
  }

  return `{
    ${entries.join(",\n    ")}
  }`;
};

const renderFieldMap = (fields: Record<string, GraphQLField<unknown, unknown>>): string => {
  const lines = Object.keys(fields)
    .map((fieldName) => {
      const field = fields[fieldName];
      if (!field) {
        return null;
      }

      return `${fieldName}: {
      arguments: ${renderArgumentMap(field.args)},
      type: ${renderFieldType(field.type)},
    }`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    return "{}";
  }

  return `{
    ${lines.join(",\n    ")}
  }`;
};

const renderScalarDefinition = (typeName: string): string => {
  const tsType = builtinScalars.get(typeName) ?? "string";
  return `...define("${typeName}").scalar<${tsType}>()`;
};

const renderObjectDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isObjectType(type)) {
    return "";
  }

  const fields = renderFieldMap(type.getFields());

  return `...define("${type.name}").object(${fields})`;
};

const renderInputDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isInputObjectType(type)) {
    return "";
  }

  const entries = Object.keys(type.getFields())
    .map((fieldName) => {
      const field = type.getFields()[fieldName];
      if (!field) {
        return null;
      }

      return `${fieldName}: ${renderFieldType(field.type)}`;
    })
    .filter((value): value is string => value !== null);

  const body =
    entries.length === 0
      ? "{}"
      : `{
    ${entries.join(",\n    ")}
  }`;

  return `...define("${type.name}").input(${body})`;
};

const renderEnumDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isEnumType(type)) {
    return "";
  }

  const values = type
    .getValues()
    .map((value) => `${value.name}: true`)
    .join(", ");
  return `...define("${type.name}").enum({ ${values} })`;
};

const renderUnionDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isUnionType(type)) {
    return "";
  }

  const values = type
    .getTypes()
    .map((member) => `${member.name}: true`)
    .join(", ");

  return `...define("${type.name}").union({ ${values} })`;
};

const collectObjectTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isObjectType(type) && !isInterfaceType(type);
    })
    .sort();

const collectInputTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isInputObjectType(type);
    })
    .sort();

const collectEnumTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isEnumType(type);
    })
    .sort();

const collectUnionTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isUnionType(type);
    })
    .sort();

export type GeneratedModule = {
  readonly code: string;
  readonly stats: {
    readonly objects: number;
    readonly enums: number;
    readonly inputs: number;
    readonly unions: number;
  };
};

export const generateRuntimeModule = (schema: GraphQLSchema): GeneratedModule => {
  const scalarDefinitions = collectScalarNames(schema)
    .filter((name) => !builtinScalars.has(name))
    .map((name) => renderScalarDefinition(name));

  const objectTypeNames = collectObjectTypeNames(schema);
  const enumTypeNames = collectEnumTypeNames(schema);
  const inputTypeNames = collectInputTypeNames(schema);
  const unionTypeNames = collectUnionTypeNames(schema);

  const scalarBlock = `{
    ${Array.from(builtinScalars.keys())
      .map((name) => renderScalarDefinition(name))
      .concat(scalarDefinitions)
      .join(",\n    ")}
  }`;

  const enumBlock =
    enumTypeNames.length === 0
      ? "{}"
      : `{
    ${enumTypeNames.map((name) => renderEnumDefinition(schema, name)).join(",\n    ")}
  }`;

  const inputBlock =
    inputTypeNames.length === 0
      ? "{}"
      : `{
    ${inputTypeNames.map((name) => renderInputDefinition(schema, name)).join(",\n    ")}
  }`;

  const objectBlock =
    objectTypeNames.length === 0
      ? "{}"
      : `{
    ${objectTypeNames.map((name) => renderObjectDefinition(schema, name)).join(",\n    ")}
  }`;

  const unionBlock =
    unionTypeNames.length === 0
      ? "{}"
      : `{
    ${unionTypeNames.map((name) => renderUnionDefinition(schema, name)).join(",\n    ")}
  }`;

  const queryType = schema.getQueryType()?.name ?? "Query";
  const mutationType = schema.getMutationType()?.name ?? "Mutation";
  const subscriptionType = schema.getSubscriptionType()?.name ?? "Subscription";

  const code = `import { createGql } from "@soda-gql/core";
import { define } from "@soda-gql/core/types/schema";
import { createRefFactories, unsafeRef } from "@soda-gql/core/types/type-ref";
import type { GraphqlAdapter } from "@soda-gql/core/types/adapter";

const schema = {
  schema: {
    query: "${queryType}",
    mutation: "${mutationType}",
    subscription: "${subscriptionType}",
  },
  scalar: ${scalarBlock},
  enum: ${enumBlock},
  input: ${inputBlock},
  object: ${objectBlock},
  union: ${unionBlock},
} as const;

const adapter: GraphqlAdapter = {
  createError: (raw) => raw,
};

export const gql = createGql({
  schema,
  adapter,
});

export { schema };
export type GeneratedSchema = typeof schema;
`;

  return {
    code,
    stats: {
      objects: objectTypeNames.length,
      enums: enumTypeNames.length,
      inputs: inputTypeNames.length,
      unions: unionTypeNames.length,
    },
  };
};

const collectScalarNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isScalarType(type);
    })
    .sort();
