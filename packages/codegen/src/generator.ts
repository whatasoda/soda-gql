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

const buildTypeModifier = (levels: TypeLevel[]): string => {
  let modifier = "?";

  for (const level of levels.slice().reverse()) {
    if (level.kind === "named") {
      // Inner type: always explicit nullable marker
      modifier = level.nonNull ? "!" : "?";
      continue;
    }

    // List type: append []? or []! based on list's nullability
    const listSuffix = level.nonNull ? "[]!" : "[]?";
    modifier = `${modifier}${listSuffix}`;
  }

  return modifier;
};

const parseTypeReference = (type: TypeNode): { readonly name: string; readonly modifier: string } => {
  const { name, levels } = collectTypeLevels(type);
  return { name, modifier: buildTypeModifier(levels) };
};

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
  const defaultValue = renderDefaultValue(definition.defaultValue ?? null);
  const directives = renderDirectives(definition.directives);

  let kind: "scalar" | "enum" | "input";
  if (isScalarName(schema, name)) {
    kind = "scalar";
  } else if (isEnumName(schema, name)) {
    kind = "enum";
  } else {
    kind = "input";
  }

  return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}", defaultValue: ${defaultValue}, directives: ${directives} }`;
};

const renderArgumentMap = (schema: SchemaIndex, args: readonly InputValueDefinitionNode[] | undefined): string => {
  const entries = [...(args ?? [])]
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((arg) => `${arg.name.value}: ${renderInputRef(schema, arg)}`);

  return renderPropertyLines({ entries, indentSize: 8 });
};

const renderOutputRef = (schema: SchemaIndex, type: TypeNode, args: readonly InputValueDefinitionNode[] | undefined): string => {
  const { name, modifier } = parseTypeReference(type);
  const argumentMap = renderArgumentMap(schema, args);

  let kind: "scalar" | "enum" | "union" | "object";
  if (isScalarName(schema, name)) {
    kind = "scalar";
  } else if (isEnumName(schema, name)) {
    kind = "enum";
  } else if (isUnionName(schema, name)) {
    kind = "union";
  } else if (isObjectName(schema, name)) {
    kind = "object";
  } else {
    kind = "scalar"; // fallback for unknown types
  }

  return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}", arguments: ${argumentMap} }`;
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
    .map((field) => `${field.name.value}: ${renderOutputRef(schema, field.type, field.arguments)}`);

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
  return `${record.name}: { name: "${record.name}", $type: {} as { input: ${typeInfo.input}; output: ${typeInfo.output}; inputProfile: { kind: "scalar"; name: "${record.name}"; value: ${typeInfo.input} }; outputProfile: { kind: "scalar"; name: "${record.name}"; value: ${typeInfo.output} } } }`;
};

const renderObjectDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.objects.get(typeName);
  if (!record) {
    return "";
  }

  const fields = renderObjectFields(schema, record.fields);
  return `${record.name}: { name: "${record.name}", fields: ${fields} }`;
};

const renderInputDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.inputs.get(typeName);
  if (!record) {
    return "";
  }

  const fields = renderInputFields(schema, record.fields);
  return `${record.name}: { name: "${record.name}", fields: ${fields} }`;
};

const renderEnumDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.enums.get(typeName);
  if (!record) {
    return "";
  }

  const valueNames = Array.from(record.values.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((value) => value.name.value);
  const valuesObj = valueNames.length === 0 ? "{}" : `{ ${valueNames.map((v) => `${v}: true`).join(", ")} }`;
  const valueUnion = valueNames.length === 0 ? "never" : valueNames.map((v) => `"${v}"`).join(" | ");

  return `${record.name}: { name: "${record.name}", values: ${valuesObj}, $type: {} as { name: "${record.name}"; inputProfile: { kind: "enum"; name: "${record.name}"; value: ${valueUnion} }; outputProfile: { kind: "enum"; name: "${record.name}"; value: ${valueUnion} } } }`;
};

const renderUnionDefinition = (schema: SchemaIndex, typeName: string): string => {
  const record = schema.unions.get(typeName);
  if (!record) {
    return "";
  }

  const memberNames = Array.from(record.members.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((member) => member.name.value);
  const typesObj = memberNames.length === 0 ? "{}" : `{ ${memberNames.map((m) => `${m}: true`).join(", ")} }`;

  return `${record.name}: { name: "${record.name}", types: ${typesObj} }`;
};

const collectObjectTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.objects.keys())
    .filter((name) => !name.startsWith("__"))
    .sort((left, right) => left.localeCompare(right));

const renderFragmentBuildersType = (objectTypeNames: string[], schemaName: string, adapterTypeName?: string): string => {
  if (objectTypeNames.length === 0) {
    return `type FragmentBuilders_${schemaName} = Record<string, never>;`;
  }

  const adapterPart = adapterTypeName ? `, ExtractMetadataAdapter<${adapterTypeName}>` : "";
  const entries = objectTypeNames.map(
    (name) => `  readonly ${name}: FragmentBuilderFor<Schema_${schemaName}, "${name}"${adapterPart}>`,
  );
  return `type FragmentBuilders_${schemaName} = {\n${entries.join(";\n")};\n};`;
};

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

const renderInputTypeMethod = (factoryVar: string, kind: "scalar" | "enum" | "input", typeName: string): string =>
  `${typeName}: ${factoryVar}("${kind}", "${typeName}")`;

const renderInputTypeMethods = (schema: SchemaIndex, factoryVar: string): string => {
  const scalarMethods = Array.from(builtinScalarTypes.keys())
    .concat(collectScalarNames(schema).filter((name) => !builtinScalarTypes.has(name)))
    .map((name) => renderInputTypeMethod(factoryVar, "scalar", name));

  const enumMethods = collectEnumTypeNames(schema).map((name) => renderInputTypeMethod(factoryVar, "enum", name));

  const inputMethods = collectInputTypeNames(schema).map((name) => renderInputTypeMethod(factoryVar, "input", name));

  const allMethods = [...scalarMethods, ...enumMethods, ...inputMethods].sort((left, right) => {
    const leftName = left.split(":")[0] ?? "";
    const rightName = right.split(":")[0] ?? "";
    return leftName.localeCompare(rightName);
  });

  return renderPropertyLines({ entries: allMethods, indentSize: 2 });
};

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
  readonly scalarImportPath: string;
  readonly adapterImportPath?: string;
};

type RuntimeTemplateInjection =
  | { readonly mode: "inline" }
  | {
      readonly mode: "inject";
      readonly perSchema: Map<string, PerSchemaInjection>;
    };

export type RuntimeGenerationOptions = {
  readonly injection?: Map<string, PerSchemaInjection>;
  readonly defaultInputDepth?: Map<string, number>;
  readonly inputDepthOverrides?: Map<string, Readonly<Record<string, number>>>;
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
      readonly inputTypeMethodsBlock: string;
      readonly fragmentBuildersTypeBlock: string;
      readonly defaultInputDepth?: number;
      readonly inputDepthOverrides?: Readonly<Record<string, number>>;
    }
  >;
  readonly injection: RuntimeTemplateInjection;
};

const multiRuntimeTemplate = ($$: MultiRuntimeTemplateOptions) => {
  // Build imports based on injection mode
  const imports: string[] = [];
  const scalarAliases = new Map<string, string>();
  const adapterAliases = new Map<string, string>();

  if ($$.injection.mode === "inject") {
    // Group imports by file path
    const importsByPath = new Map<string, string[]>();

    for (const [schemaName, injection] of $$.injection.perSchema) {
      const scalarAlias = `scalar_${schemaName}`;
      scalarAliases.set(schemaName, scalarAlias);

      // Group scalar import
      const scalarSpecifiers = importsByPath.get(injection.scalarImportPath) ?? [];
      if (!importsByPath.has(injection.scalarImportPath)) {
        importsByPath.set(injection.scalarImportPath, scalarSpecifiers);
      }
      scalarSpecifiers.push(`scalar as ${scalarAlias}`);

      // Group adapter import (optional)
      if (injection.adapterImportPath) {
        const adapterAlias = `adapter_${schemaName}`;
        adapterAliases.set(schemaName, adapterAlias);
        const adapterSpecifiers = importsByPath.get(injection.adapterImportPath) ?? [];
        if (!importsByPath.has(injection.adapterImportPath)) {
          importsByPath.set(injection.adapterImportPath, adapterSpecifiers);
        }
        adapterSpecifiers.push(`adapter as ${adapterAlias}`);
      }
    }

    // Generate grouped imports
    for (const [path, specifiers] of importsByPath) {
      if (specifiers.length === 1) {
        imports.push(`import { ${specifiers[0]} } from "${path}";`);
      } else {
        imports.push(`import {\n  ${specifiers.join(",\n  ")},\n} from "${path}";`);
      }
    }
  }

  const extraImports = imports.length > 0 ? `${imports.join("\n")}\n` : "";

  // Generate per-schema definitions
  const schemaBlocks: string[] = [];
  const gqlEntries: string[] = [];

  for (const [name, config] of Object.entries($$.schemas)) {
    const schemaVar = `${name}Schema`;
    const scalarBlock = $$.injection.mode === "inject" ? scalarAliases.get(name) : config.scalarBlock;

    // Get optional adapter
    const adapterVar = adapterAliases.get(name);

    // Build type exports with fragment builders type
    const typeExports = [`export type Schema_${name} = typeof ${schemaVar} & { _?: never };`];
    if (adapterVar) {
      typeExports.push(`export type Adapter_${name} = typeof ${adapterVar} & { _?: never };`);
    }
    typeExports.push(config.fragmentBuildersTypeBlock);

    const inputTypeMethodsVar = `inputTypeMethods_${name}`;
    const factoryVar = `createMethod_${name}`;

    // Generate __defaultInputDepth block if non-default value
    const defaultDepthBlock =
      config.defaultInputDepth !== undefined && config.defaultInputDepth !== 3
        ? `\n  __defaultInputDepth: ${config.defaultInputDepth},`
        : "";

    // Generate __inputDepthOverrides block if there are overrides
    const depthOverridesBlock =
      config.inputDepthOverrides && Object.keys(config.inputDepthOverrides).length > 0
        ? `\n  __inputDepthOverrides: ${JSON.stringify(config.inputDepthOverrides)},`
        : "";

    schemaBlocks.push(`
const ${schemaVar} = {
  label: "${name}",
  operations: { query: "${config.queryType}", mutation: "${config.mutationType}", subscription: "${config.subscriptionType}" },
  scalar: ${scalarBlock},
  enum: ${config.enumBlock},
  input: ${config.inputBlock},
  object: ${config.objectBlock},
  union: ${config.unionBlock},${defaultDepthBlock}${depthOverridesBlock}
} as const;

const ${factoryVar} = createVarMethodFactory<typeof ${schemaVar}>();
const ${inputTypeMethodsVar} = ${config.inputTypeMethodsBlock};

${typeExports.join("\n")}`);

    // Build gql entry with options - inputTypeMethods is always required
    // Include FragmentBuilders type for codegen optimization
    if (adapterVar) {
      const typeParams = `<Schema_${name}, FragmentBuilders_${name}, Adapter_${name}>`;
      gqlEntries.push(
        `  ${name}: createGqlElementComposer${typeParams}(${schemaVar}, { adapter: ${adapterVar}, inputTypeMethods: ${inputTypeMethodsVar} })`,
      );
    } else {
      const typeParams = `<Schema_${name}, FragmentBuilders_${name}>`;
      gqlEntries.push(
        `  ${name}: createGqlElementComposer${typeParams}(${schemaVar}, { inputTypeMethods: ${inputTypeMethodsVar} })`,
      );
    }
  }

  return `\
import {
  type ExtractMetadataAdapter,
  type FragmentBuilderFor,
  createGqlElementComposer,
  createVarMethodFactory,
} from "@soda-gql/core";
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

    const factoryVar = `createMethod_${name}`;
    const inputTypeMethodsBlock = renderInputTypeMethods(schema, factoryVar);
    // Pass adapter type name if injection has adapter for this schema
    const adapterTypeName = options?.injection?.get(name)?.adapterImportPath ? `Adapter_${name}` : undefined;
    const fragmentBuildersTypeBlock = renderFragmentBuildersType(objectTypeNames, name, adapterTypeName);

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
      inputTypeMethodsBlock,
      fragmentBuildersTypeBlock,
      defaultInputDepth: options?.defaultInputDepth?.get(name),
      inputDepthOverrides: options?.inputDepthOverrides?.get(name),
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
