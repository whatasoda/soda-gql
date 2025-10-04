import type { TypeModifier } from "@soda-gql/core";
import {
  type ConstDirectiveNode,
  type ConstValueNode,
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

const builtinScalarTypes = new Map<string, { readonly input: string; readonly output: string }>([
  ["ID", { input: "string", output: "string" }],
  ["String", { input: "string", output: "string" }],
  ["Int", { input: "number", output: "number" }],
  ["Float", { input: "number", output: "number" }],
  ["Boolean", { input: "boolean", output: "boolean" }],
]);

type OperationTypeNames = {
  query?: string;
  mutation?: string;
  subscription?: string;
};

type ObjectRecord = {
  readonly name: string;
  readonly fields: Map<string, FieldDefinitionNode>;
  directives: ConstDirectiveNode[];
};

type InputRecord = {
  readonly name: string;
  readonly fields: Map<string, InputValueDefinitionNode>;
  directives: ConstDirectiveNode[];
};

type EnumRecord = {
  readonly name: string;
  readonly values: Map<string, EnumValueDefinitionNode>;
  directives: ConstDirectiveNode[];
};

type UnionRecord = {
  readonly name: string;
  readonly members: Map<string, NamedTypeNode>;
  directives: ConstDirectiveNode[];
};

type ScalarRecord = {
  readonly name: string;
  directives: ConstDirectiveNode[];
};

type SchemaIndex = {
  readonly objects: Map<string, ObjectRecord>;
  readonly inputs: Map<string, InputRecord>;
  readonly enums: Map<string, EnumRecord>;
  readonly unions: Map<string, UnionRecord>;
  readonly scalars: Map<string, ScalarRecord>;
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

const mergeDirectives = (
  existing: ConstDirectiveNode[] | undefined,
  incoming: readonly ConstDirectiveNode[] | undefined,
  precedence: "definition" | "extension",
): ConstDirectiveNode[] => {
  const current = existing ?? [];
  const next = incoming ? Array.from(incoming) : [];
  return precedence === "definition" ? [...next, ...current] : [...current, ...next];
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

export const createSchemaIndex = (document: DocumentNode): SchemaIndex => {
  const objects = new Map<string, ObjectRecord>();
  const inputs = new Map<string, InputRecord>();
  const enums = new Map<string, EnumRecord>();
  const unions = new Map<string, UnionRecord>();
  const scalars = new Map<string, ScalarRecord>();
  const operationTypes: OperationTypeNames = {};

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.OBJECT_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(objects, definition.name.value, (name) => ({
          name,
          fields: new Map<string, FieldDefinitionNode>(),
          directives: [],
        }));
        addObjectFields(record.fields, definition.fields);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(inputs, definition.name.value, (name) => ({
          name,
          fields: new Map<string, InputValueDefinitionNode>(),
          directives: [],
        }));
        addInputFields(record.fields, definition.fields);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.ENUM_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(enums, definition.name.value, (name) => ({
          name,
          values: new Map<string, EnumValueDefinitionNode>(),
          directives: [],
        }));
        addEnumValues(record.values, definition.values);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.UNION_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(unions, definition.name.value, (name) => ({
          name,
          members: new Map<string, NamedTypeNode>(),
          directives: [],
        }));
        addUnionMembers(record.members, definition.types);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.SCALAR_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(scalars, definition.name.value, (name) => ({
          name,
          directives: [],
        }));
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
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
  } satisfies SchemaIndex;
};

type TypeLevel = {
  readonly kind: "list" | "named";
  readonly nonNull: boolean;
};

const collectTypeLevels = (
  type: TypeNode,
  nonNull = false,
  levels: TypeLevel[] = [],
): { readonly name: string; readonly levels: TypeLevel[] } => {
  if (type.kind === Kind.NON_NULL_TYPE) {
    return collectTypeLevels(type.type, true, levels);
  }

  if (type.kind === Kind.LIST_TYPE) {
    levels.push({ kind: "list", nonNull });
    return collectTypeLevels(type.type, false, levels);
  }

  levels.push({ kind: "named", nonNull });
  return { name: type.name.value, levels };
};

const buildTypeModifier = (levels: TypeLevel[]): TypeModifier => {
  let modifier: TypeModifier | "" = "";

  for (const level of levels.slice().reverse()) {
    if (level.kind === "named") {
      modifier = level.nonNull ? "!" : "";
      continue;
    }

    const rest: TypeModifier | "" = modifier;
    const base: TypeModifier = rest.startsWith("!") ? `![]${rest.slice(1)}` : `[]${rest}`;
    modifier = level.nonNull ? `${base}!` : base;
  }

  return modifier || "?";
};

const parseTypeReference = (type: TypeNode): { readonly name: string; readonly modifier: string } => {
  const { name, levels } = collectTypeLevels(type);
  return { name, modifier: buildTypeModifier(levels) };
};

const renderType = (name: string, modifier: string): string => JSON.stringify(`${name}:${modifier}`);

const isScalarName = (schema: SchemaIndex, name: string): boolean => builtinScalarTypes.has(name) || schema.scalars.has(name);
const isEnumName = (schema: SchemaIndex, name: string): boolean => schema.enums.has(name);
const _isInputName = (schema: SchemaIndex, name: string): boolean => schema.inputs.has(name);
const isUnionName = (schema: SchemaIndex, name: string): boolean => schema.unions.has(name);
const isObjectName = (schema: SchemaIndex, name: string): boolean => schema.objects.has(name);

const renderConstValue = (value: ConstValueNode): string => {
  switch (value.kind) {
    case Kind.NULL:
      return "null";
    case Kind.INT:
    case Kind.FLOAT:
      return value.value;
    case Kind.STRING:
    case Kind.ENUM:
      return JSON.stringify(value.value);
    case Kind.BOOLEAN:
      return value.value ? "true" : "false";
    case Kind.LIST:
      return `[${value.values.map((item) => renderConstValue(item)).join(", ")}]`;
    case Kind.OBJECT: {
      if (value.fields.length === 0) {
        return "{}";
      }
      const entries = value.fields.map((field) => `${field.name.value}: ${renderConstValue(field.value)}`);
      return `{ ${entries.join(", ")} }`;
    }
  }
};

const renderConstArgumentMap = (
  args: readonly { readonly name: { readonly value: string }; readonly value: ConstValueNode }[] | undefined,
): string => {
  const entries = (args ?? []).map((arg) => `${arg.name.value}: ${renderConstValue(arg.value)}`);
  return renderPropertyLines({ entries, indentSize: 8 });
};

const renderDirectives = (directives: readonly ConstDirectiveNode[] | undefined): string => {
  const entries = (directives ?? []).map(
    (directive) => `${directive.name.value}: ${renderConstArgumentMap(directive.arguments)}`,
  );
  return renderPropertyLines({ entries, indentSize: 8 });
};

const renderDefaultValue = (value: ConstValueNode | null | undefined): string =>
  value ? `() => (${renderConstValue(value)})` : "null";

const renderInputRef = (schema: SchemaIndex, definition: InputValueDefinitionNode): string => {
  const { name, modifier } = parseTypeReference(definition.type);
  const tuple = renderType(name, modifier);
  const defaultValue = renderDefaultValue(definition.defaultValue ?? null);
  const directives = renderDirectives(definition.directives);

  if (isScalarName(schema, name)) {
    return `unsafeInputRef.scalar(${tuple}, { default: ${defaultValue}, directives: ${directives} })`;
  }

  if (isEnumName(schema, name)) {
    return `unsafeInputRef.enum(${tuple}, { default: ${defaultValue}, directives: ${directives} })`;
  }

  return `unsafeInputRef.input(${tuple}, { default: ${defaultValue}, directives: ${directives} })`;
};

const renderArgumentMap = (schema: SchemaIndex, args: readonly InputValueDefinitionNode[] | undefined): string => {
  const entries = [...(args ?? [])]
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((arg) => `${arg.name.value}: ${renderInputRef(schema, arg)}`);

  return renderPropertyLines({ entries, indentSize: 8 });
};

const renderOutputRef = (
  schema: SchemaIndex,
  type: TypeNode,
  args: readonly InputValueDefinitionNode[] | undefined,
  directives: readonly ConstDirectiveNode[] | undefined,
): string => {
  const { name, modifier } = parseTypeReference(type);
  const modifiedType = renderType(name, modifier);
  const argumentMap = renderArgumentMap(schema, args);
  const directiveMap = renderDirectives(directives);

  if (isScalarName(schema, name)) {
    return `unsafeOutputRef.scalar(${modifiedType}, { arguments: ${argumentMap}, directives: ${directiveMap} })`;
  }

  if (isEnumName(schema, name)) {
    return `unsafeOutputRef.enum(${modifiedType}, { arguments: ${argumentMap}, directives: ${directiveMap} })`;
  }

  if (isUnionName(schema, name)) {
    return `unsafeOutputRef.union(${modifiedType}, { arguments: ${argumentMap}, directives: ${directiveMap} })`;
  }

  if (isObjectName(schema, name)) {
    return `unsafeOutputRef.object(${modifiedType}, { arguments: ${argumentMap}, directives: ${directiveMap} })`;
  }

  return `unsafeOutputRef.scalar(${modifiedType}, { arguments: ${argumentMap}, directives: ${directiveMap} })`;
};

const renderPropertyLines = ({ entries, indentSize }: { entries: string[]; indentSize: number }) => {
  if (entries.length === 0) {
    return "{}";
  }

  const indent = " ".repeat(indentSize);
  const lastIndent = " ".repeat(indentSize - 2);
  return ["{", `${indent}${entries.join(`,\n${indent}`)},`, `${lastIndent}}`].join(`\n`);
};

const renderObjectFields = (schema: SchemaIndex, fields: Map<string, FieldDefinitionNode>): string => {
  const entries = Array.from(fields.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((field) => `${field.name.value}: ${renderOutputRef(schema, field.type, field.arguments, field.directives)}`);

  return renderPropertyLines({ entries, indentSize: 6 });
};

const renderInputFields = (schema: SchemaIndex, fields: Map<string, InputValueDefinitionNode>): string => {
  const entries = Array.from(fields.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((field) => `${field.name.value}: ${renderInputRef(schema, field)}`);

  return renderPropertyLines({ entries, indentSize: 6 });
};

const renderScalarDefinition = (record: ScalarRecord): string => {
  const typeInfo = builtinScalarTypes.get(record.name) ?? { input: "string", output: "string" };
  const scalarType = `type<{ input: ${typeInfo.input}; output: ${typeInfo.output} }>()`;
  return `${record.name}: define("${record.name}").scalar(${scalarType}, ${renderDirectives(record.directives)})`;
};

const renderObjectDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.objects.get(typeName);
  if (!record) {
    return "";
  }

  const fields = renderObjectFields(schema, record.fields);
  return `${record.name}: define("${record.name}").object(${fields}, ${renderDirectives(record.directives)})`;
};

const renderInputDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.inputs.get(typeName);
  if (!record) {
    return "";
  }

  const fields = renderInputFields(schema, record.fields);
  return `${record.name}: define("${record.name}").input(${fields}, ${renderDirectives(record.directives)})`;
};

const renderEnumDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.enums.get(typeName);
  if (!record) {
    return "";
  }

  const values = Array.from(record.values.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((value) => `${value.name.value}: true`)
    .join(", ");
  const body = values.length === 0 ? "{}" : `{ ${values} }`;

  return `${record.name}: define("${record.name}").enum(${body}, ${renderDirectives(record.directives)})`;
};

const renderUnionDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.unions.get(typeName);
  if (!record) {
    return "";
  }

  const members = Array.from(record.members.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((member) => `${member.name.value}: true`)
    .join(", ");
  const body = members.length === 0 ? "{}" : `{ ${members} }`;

  return `${record.name}: define("${record.name}").union(${body}, ${renderDirectives(record.directives)})`;
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

const collectScalarNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.scalars.keys())
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

type PerSchemaInjection = {
  readonly adapterImportPath: string;
  readonly scalarImportPath: string;
};

type RuntimeTemplateInjection =
  | { readonly mode: "inline" }
  | {
      readonly mode: "inject";
      readonly perSchema: Map<string, PerSchemaInjection>;
    };

export type RuntimeGenerationOptions = {
  readonly injection?: Map<string, PerSchemaInjection>;
};

type MultiRuntimeTemplateOptions = {
  readonly schemas: Record<
    string,
    {
      readonly queryType: string;
      readonly mutationType: string;
      readonly subscriptionType: string;
      readonly scalarBlock: string;
      readonly enumBlock: string;
      readonly inputBlock: string;
      readonly objectBlock: string;
      readonly unionBlock: string;
    }
  >;
  readonly injection: RuntimeTemplateInjection;
};

const multiRuntimeTemplate = ($$: MultiRuntimeTemplateOptions) => {
  // Build imports based on injection mode
  const imports: string[] = [];
  const adapterAliases = new Map<string, string>();
  const scalarAliases = new Map<string, string>();

  if ($$.injection.mode === "inject") {
    // Generate per-schema imports
    for (const [schemaName, injection] of $$.injection.perSchema) {
      const adapterAlias = `adapter_${schemaName}`;
      const scalarAlias = `scalar_${schemaName}`;
      adapterAliases.set(schemaName, adapterAlias);
      scalarAliases.set(schemaName, scalarAlias);

      imports.push(`import { adapter as ${adapterAlias} } from "${injection.adapterImportPath}";`);
      imports.push(`import { scalar as ${scalarAlias} } from "${injection.scalarImportPath}";`);
    }
  }

  const extraImports = imports.join("\n");

  // Generate per-schema definitions
  const schemaBlocks: string[] = [];
  const gqlEntries: string[] = [];

  for (const [name, config] of Object.entries($$.schemas)) {
    const schemaVar = `${name}Schema`;
    const adapterVar = $$.injection.mode === "inject" ? adapterAliases.get(name) : `adapter_${name}`;
    const scalarBlock = $$.injection.mode === "inject" ? scalarAliases.get(name) : config.scalarBlock;

    // Generate adapter if inline mode
    const adapterDefinition =
      $$.injection.mode === "inject"
        ? ""
        : `const ${adapterVar} = createRuntimeAdapter(({ type }) => ({\n  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),\n}));\n`;

    schemaBlocks.push(`${adapterDefinition}
const ${schemaVar} = {
  operations: defineOperationRoots({
    query: "${config.queryType}",
    mutation: "${config.mutationType}",
    subscription: "${config.subscriptionType}",
  }),
  scalar: ${scalarBlock},
  enum: ${config.enumBlock},
  input: ${config.inputBlock},
  object: ${config.objectBlock},
  union: ${config.unionBlock},
} satisfies AnyGraphqlSchema;

export type Schema_${name} = typeof ${schemaVar} & { _?: never };
export type Adapter_${name} = typeof ${adapterVar} & { _?: never };`);

    gqlEntries.push(`  ${name}: createGqlInvoker<Schema_${name}, Adapter_${name}>(${schemaVar})`);
  }

  return `\
import {
  type AnyGraphqlSchema,
  createGqlInvoker,
  define,
  defineOperationRoots,
  unsafeInputRef,
  unsafeOutputRef,
} from "@soda-gql/core";
import { createRuntimeAdapter } from "@soda-gql/runtime";
${extraImports}

${schemaBlocks.join("\n")}

export const gql = {
${gqlEntries.join(",\n")}
};
`;
};

export const generateMultiSchemaModule = (
  schemas: Map<string, DocumentNode>,
  options?: RuntimeGenerationOptions,
): GeneratedModule => {
  // biome-ignore lint/suspicious/noExplicitAny: complex schema config type
  const schemaConfigs: Record<string, any> = {};
  const allStats = {
    objects: 0,
    enums: 0,
    inputs: 0,
    unions: 0,
  };

  for (const [name, document] of schemas.entries()) {
    const schema = createSchemaIndex(document);

    const builtinScalarDefinitions = Array.from(builtinScalarTypes.keys()).map((name) =>
      renderScalarDefinition(schema.scalars.get(name) ?? { name, directives: [] }),
    );

    const customScalarDefinitions = collectScalarNames(schema)
      .filter((name) => !builtinScalarTypes.has(name))
      .map((name) => {
        const record = schema.scalars.get(name);
        return record ? renderScalarDefinition(record) : "";
      })
      .filter((definition) => definition.length > 0);

    const allScalarDefinitions = builtinScalarDefinitions.concat(customScalarDefinitions);

    const objectTypeNames = collectObjectTypeNames(schema);
    const enumTypeNames = collectEnumTypeNames(schema);
    const inputTypeNames = collectInputTypeNames(schema);
    const unionTypeNames = collectUnionTypeNames(schema);

    const scalarBlock = renderPropertyLines({ entries: allScalarDefinitions, indentSize: 4 });
    const enumDefinitions = enumTypeNames
      .map((name) => renderEnumDefinition(schema, name))
      .filter((definition) => definition.length > 0);
    const enumBlock = renderPropertyLines({ entries: enumDefinitions, indentSize: 4 });
    const inputDefinitions = inputTypeNames
      .map((name) => renderInputDefinition(schema, name))
      .filter((definition) => definition.length > 0);
    const inputBlock = renderPropertyLines({ entries: inputDefinitions, indentSize: 4 });
    const objectDefinitions = objectTypeNames
      .map((name) => renderObjectDefinition(schema, name))
      .filter((definition) => definition.length > 0);
    const objectBlock = renderPropertyLines({ entries: objectDefinitions, indentSize: 4 });
    const unionDefinitions = unionTypeNames
      .map((name) => renderUnionDefinition(schema, name))
      .filter((definition) => definition.length > 0);
    const unionBlock = renderPropertyLines({ entries: unionDefinitions, indentSize: 4 });

    const queryType = schema.operationTypes.query ?? "Query";
    const mutationType = schema.operationTypes.mutation ?? "Mutation";
    const subscriptionType = schema.operationTypes.subscription ?? "Subscription";

    schemaConfigs[name] = {
      queryType,
      mutationType,
      subscriptionType,
      scalarBlock,
      enumBlock,
      inputBlock,
      objectBlock,
      unionBlock,
    };

    // Accumulate stats
    allStats.objects += objectDefinitions.length;
    allStats.enums += enumDefinitions.length;
    allStats.inputs += inputDefinitions.length;
    allStats.unions += unionDefinitions.length;
  }

  const injection: RuntimeTemplateInjection = options?.injection
    ? { mode: "inject", perSchema: options.injection }
    : { mode: "inline" };

  const code = multiRuntimeTemplate({
    schemas: schemaConfigs,
    injection,
  });

  return {
    code,
    stats: allStats,
  };
};
