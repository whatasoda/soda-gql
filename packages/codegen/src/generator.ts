import {
  type DocumentNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  Kind,
  type NamedTypeNode,
  type SchemaDefinitionNode,
  type SchemaExtensionNode,
  type TypeNode,
} from "graphql";

const builtinScalars = new Map<string, string>([
  ["ID", "string"],
  ["String", "string"],
  ["Int", "number"],
  ["Float", "number"],
  ["Boolean", "boolean"],
]);

type OperationTypeNames = {
  query?: string;
  mutation?: string;
  subscription?: string;
};

type ObjectRecord = {
  readonly name: string;
  readonly fields: Map<string, FieldDefinitionNode>;
};

type InputRecord = {
  readonly name: string;
  readonly fields: Map<string, InputValueDefinitionNode>;
};

type EnumRecord = {
  readonly name: string;
  readonly values: Map<string, EnumValueDefinitionNode>;
};

type UnionRecord = {
  readonly name: string;
  readonly members: Map<string, NamedTypeNode>;
};

type SchemaIndex = {
  readonly objects: Map<string, ObjectRecord>;
  readonly inputs: Map<string, InputRecord>;
  readonly enums: Map<string, EnumRecord>;
  readonly unions: Map<string, UnionRecord>;
  readonly scalars: Set<string>;
  readonly operationTypes: OperationTypeNames;
};

const ensureRecord = <T>(collection: Map<string, T>, key: string, factory: (name: string) => T): T => {
  const existing = collection.get(key);
  if (existing) {
    return existing;
  }

  const created = factory(key);
  collection.set(key, created);
  return created;
};

const addObjectFields = (target: Map<string, FieldDefinitionNode>, fields: readonly FieldDefinitionNode[] | undefined): void => {
  if (!fields) {
    return;
  }

  for (const field of fields) {
    target.set(field.name.value, field);
  }
};

const addInputFields = (
  target: Map<string, InputValueDefinitionNode>,
  fields: readonly InputValueDefinitionNode[] | undefined,
): void => {
  if (!fields) {
    return;
  }

  for (const field of fields) {
    target.set(field.name.value, field);
  }
};

const addEnumValues = (
  target: Map<string, EnumValueDefinitionNode>,
  values: readonly EnumValueDefinitionNode[] | undefined,
): void => {
  if (!values) {
    return;
  }

  for (const value of values) {
    target.set(value.name.value, value);
  }
};

const addUnionMembers = (target: Map<string, NamedTypeNode>, members: readonly NamedTypeNode[] | undefined): void => {
  if (!members) {
    return;
  }

  for (const member of members) {
    target.set(member.name.value, member);
  }
};

const updateOperationTypes = (
  operationTypes: OperationTypeNames,
  definition: SchemaDefinitionNode | SchemaExtensionNode,
): void => {
  for (const operation of definition.operationTypes ?? []) {
    const typeName = operation.type.name.value;
    switch (operation.operation) {
      case "query":
        operationTypes.query = typeName;
        break;
      case "mutation":
        operationTypes.mutation = typeName;
        break;
      case "subscription":
        operationTypes.subscription = typeName;
        break;
      default:
        break;
    }
  }
};

const createSchemaIndex = (document: DocumentNode): SchemaIndex => {
  const objects = new Map<string, ObjectRecord>();
  const inputs = new Map<string, InputRecord>();
  const enums = new Map<string, EnumRecord>();
  const unions = new Map<string, UnionRecord>();
  const scalars = new Set<string>();
  const operationTypes: OperationTypeNames = {};

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION: {
        const record = ensureRecord(objects, definition.name.value, (name) => ({
          name,
          fields: new Map<string, FieldDefinitionNode>(),
        }));
        addObjectFields(record.fields, definition.fields);
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const record = ensureRecord(inputs, definition.name.value, (name) => ({
          name,
          fields: new Map<string, InputValueDefinitionNode>(),
        }));
        addInputFields(record.fields, definition.fields);
        break;
      }
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION: {
        const record = ensureRecord(enums, definition.name.value, (name) => ({
          name,
          values: new Map<string, EnumValueDefinitionNode>(),
        }));
        addEnumValues(record.values, definition.values);
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION: {
        const record = ensureRecord(unions, definition.name.value, (name) => ({
          name,
          members: new Map<string, NamedTypeNode>(),
        }));
        addUnionMembers(record.members, definition.types);
        break;
      }
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
        scalars.add(definition.name.value);
        break;
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
        updateOperationTypes(operationTypes, definition);
        break;
      default:
        break;
    }
  }

  if (!operationTypes.query && objects.has("Query")) {
    operationTypes.query = "Query";
  }
  if (!operationTypes.mutation && objects.has("Mutation")) {
    operationTypes.mutation = "Mutation";
  }
  if (!operationTypes.subscription && objects.has("Subscription")) {
    operationTypes.subscription = "Subscription";
  }

  return {
    objects,
    inputs,
    enums,
    unions,
    scalars,
    operationTypes,
  };
};

type TypeShape =
  | {
      readonly kind: "named";
      readonly required: boolean;
    }
  | {
      readonly kind: "list";
      readonly required: boolean;
      readonly itemRequired: boolean;
    };

const toTypeShape = (type: TypeNode): TypeShape => {
  if (type.kind === Kind.NON_NULL_TYPE) {
    const inner = toTypeShape(type.type);
    if (inner.kind === "named") {
      return { kind: "named", required: true } satisfies TypeShape;
    }

    return {
      kind: "list",
      required: true,
      itemRequired: inner.itemRequired,
    } satisfies TypeShape;
  }

  if (type.kind === Kind.LIST_TYPE) {
    const inner = toTypeShape(type.type);

    if (inner.kind === "named") {
      return {
        kind: "list",
        required: false,
        itemRequired: inner.required,
      } satisfies TypeShape;
    }

    return {
      kind: "list",
      required: false,
      itemRequired: inner.itemRequired,
    } satisfies TypeShape;
  }

  return { kind: "named", required: false } satisfies TypeShape;
};

const formatForGraphqlType = (type: TypeNode): string => {
  const shape = toTypeShape(type);

  if (shape.kind === "named") {
    return shape.required ? "!" : "?";
  }

  const itemFlag = shape.itemRequired ? "!" : "?";
  const listFlag = shape.required ? "!" : "?";

  return `${itemFlag}[]${listFlag}`;
};

const unwrapNamedType = (type: TypeNode): string => {
  if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
    return unwrapNamedType(type.type);
  }
  return type.name.value;
};

const renderFieldType = (schema: SchemaIndex, type: TypeNode): string => {
  const format = formatForGraphqlType(type);
  const named = unwrapNamedType(type);

  if (builtinScalars.has(named) || schema.scalars.has(named)) {
    return `unsafeRef.scalar("${named}", "${format}")`;
  }

  if (schema.enums.has(named)) {
    return `unsafeRef.enum("${named}", "${format}")`;
  }

  if (schema.unions.has(named)) {
    return `unsafeRef.union("${named}", "${format}")`;
  }

  if (schema.inputs.has(named)) {
    return `unsafeRef.input("${named}", "${format}")`;
  }

  return `unsafeRef.object("${named}", "${format}")`;
};

const renderArgumentMap = (schema: SchemaIndex, args: readonly InputValueDefinitionNode[] | undefined): string => {
  const sorted = [...(args ?? [])].sort((left, right) => left.name.value.localeCompare(right.name.value));

  if (sorted.length === 0) {
    return "{}";
  }

  const entries = sorted.map((arg) => `${arg.name.value}: ${renderFieldType(schema, arg.type)}`);

  return `{
    ${entries.join(",\n    ")}
  }`;
};

const renderFieldMap = (schema: SchemaIndex, fields: Map<string, FieldDefinitionNode>): string => {
  const sorted = Array.from(fields.values()).sort((left, right) => left.name.value.localeCompare(right.name.value));

  if (sorted.length === 0) {
    return "{}";
  }

  const lines = sorted.map(
    (field) => `${field.name.value}: {
      arguments: ${renderArgumentMap(schema, field.arguments)},
      type: ${renderFieldType(schema, field.type)},
    }`,
  );

  return `{
    ${lines.join(",\n    ")}
  }`;
};

const renderScalarDefinition = (typeName: string): string => {
  const tsType = builtinScalars.get(typeName) ?? "string";
  return `...define("${typeName}").scalar<${tsType}>()`;
};

const renderObjectDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.objects.get(typeName);
  if (!record) {
    return "";
  }

  const fields = renderFieldMap(schema, record.fields);
  return `...define("${record.name}").object(${fields})`;
};

const renderInputDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.inputs.get(typeName);
  if (!record) {
    return "";
  }

  const sorted = Array.from(record.fields.values()).sort((left, right) => left.name.value.localeCompare(right.name.value));
  const entries = sorted.map((field) => `${field.name.value}: ${renderFieldType(schema, field.type)}`);

  const body =
    entries.length === 0
      ? "{}"
      : `{
    ${entries.join(",\n    ")}
  }`;

  return `...define("${record.name}").input(${body})`;
};

const renderEnumDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.enums.get(typeName);
  if (!record) {
    return "";
  }

  const sorted = Array.from(record.values.values()).sort((left, right) => left.name.value.localeCompare(right.name.value));
  const values = sorted.map((value) => `${value.name.value}: true`).join(", ");

  return `...define("${record.name}").enum({ ${values} })`;
};

const renderUnionDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.unions.get(typeName);
  if (!record) {
    return "";
  }

  const sorted = Array.from(record.members.values()).sort((left, right) => left.name.value.localeCompare(right.name.value));
  const values = sorted.map((member) => `${member.name.value}: true`).join(", ");

  return `...define("${record.name}").union({ ${values} })`;
};

const collectObjectTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.objects.keys())
    .filter((name) => !name.startsWith("__"))
    .sort((left, right) => left.localeCompare(right));

const collectInputTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.inputs.keys())
    .filter((name) => !name.startsWith("__"))
    .sort((left, right) => left.localeCompare(right));

const collectEnumTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.enums.keys())
    .filter((name) => !name.startsWith("__"))
    .sort((left, right) => left.localeCompare(right));

const collectUnionTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.unions.keys())
    .filter((name) => !name.startsWith("__"))
    .sort((left, right) => left.localeCompare(right));

export type GeneratedModule = {
  readonly code: string;
  readonly stats: {
    readonly objects: number;
    readonly enums: number;
    readonly inputs: number;
    readonly unions: number;
  };
};

const runtimeTemplate = ($$: {
  queryType: string;
  mutationType: string;
  subscriptionType: string;
  scalarBlock: string;
  enumBlock: string;
  inputBlock: string;
  objectBlock: string;
  unionBlock: string;
}) => `\
import { createGql, define, defineOperationTypeNames, unsafeRef, type AnyGraphqlSchema, type GraphqlAdapter } from "@soda-gql/core";

export const schema = {
  operations: defineOperationTypeNames({
    query: "${$$.queryType}",
    mutation: "${$$.mutationType}",
    subscription: "${$$.subscriptionType}",
  }),
  scalar: ${$$.scalarBlock},
  enum: ${$$.enumBlock},
  input: ${$$.inputBlock},
  object: ${$$.objectBlock},
  union: ${$$.unionBlock},
} satisfies AnyGraphqlSchema;

const adapter = {
  createError: (raw) => raw,
} satisfies GraphqlAdapter;

export const gql = createGql({ schema, adapter });

export type Schema = typeof schema & { _?: never };
export type Adapter = typeof adapter & { _?: never };
`;

const collectScalarNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.scalars)
    .filter((name) => !name.startsWith("__"))
    .sort((left, right) => left.localeCompare(right));

export const generateRuntimeModule = (document: DocumentNode): GeneratedModule => {
  const schema = createSchemaIndex(document);

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

  const enumDefinitions = enumTypeNames
    .map((name) => renderEnumDefinition(schema, name))
    .filter((definition) => definition.length > 0);
  const enumBlock =
    enumDefinitions.length === 0
      ? "{}"
      : `{
    ${enumDefinitions.join(",\n    ")}
  }`;

  const inputDefinitions = inputTypeNames
    .map((name) => renderInputDefinition(schema, name))
    .filter((definition) => definition.length > 0);
  const inputBlock =
    inputDefinitions.length === 0
      ? "{}"
      : `{
    ${inputDefinitions.join(",\n    ")}
  }`;

  const objectDefinitions = objectTypeNames
    .map((name) => renderObjectDefinition(schema, name))
    .filter((definition) => definition.length > 0);
  const objectBlock =
    objectDefinitions.length === 0
      ? "{}"
      : `{
    ${objectDefinitions.join(",\n    ")}
  }`;

  const unionDefinitions = unionTypeNames
    .map((name) => renderUnionDefinition(schema, name))
    .filter((definition) => definition.length > 0);
  const unionBlock =
    unionDefinitions.length === 0
      ? "{}"
      : `{
    ${unionDefinitions.join(",\n    ")}
  }`;

  const queryType = schema.operationTypes.query ?? "Query";
  const mutationType = schema.operationTypes.mutation ?? "Mutation";
  const subscriptionType = schema.operationTypes.subscription ?? "Subscription";

  const code = runtimeTemplate({
    queryType,
    mutationType,
    subscriptionType,
    scalarBlock,
    enumBlock,
    inputBlock,
    objectBlock,
    unionBlock,
  });

  return {
    code,
    stats: {
      objects: objectDefinitions.length,
      enums: enumDefinitions.length,
      inputs: inputDefinitions.length,
      unions: unionDefinitions.length,
    },
  };
};
