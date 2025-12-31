/**
 * Granular code generator - each type definition is a separate variable
 *
 * Key optimizations:
 * 1. Each individual type (input, object, etc.) is its own const variable
 * 2. Category objects (input_hasura, object_hasura) are assembled from references
 * 3. Maximally splits TypeScript's type inference work
 */
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

type OperationTypeNames = { query?: string; mutation?: string; subscription?: string };

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
  if (existing) return existing;
  const created = factory(key);
  collection.set(key, created);
  return created;
};

const addObjectFields = (target: Map<string, FieldDefinitionNode>, fields: readonly FieldDefinitionNode[] | undefined): void => {
  if (!fields) return;
  for (const field of fields) target.set(field.name.value, field);
};

const addInputFields = (target: Map<string, InputValueDefinitionNode>, fields: readonly InputValueDefinitionNode[] | undefined): void => {
  if (!fields) return;
  for (const field of fields) target.set(field.name.value, field);
};

const addEnumValues = (target: Map<string, EnumValueDefinitionNode>, values: readonly EnumValueDefinitionNode[] | undefined): void => {
  if (!values) return;
  for (const value of values) target.set(value.name.value, value);
};

const addUnionMembers = (target: Map<string, NamedTypeNode>, members: readonly NamedTypeNode[] | undefined): void => {
  if (!members) return;
  for (const member of members) target.set(member.name.value, member);
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
      case "query": operationTypes.query = typeName; break;
      case "mutation": operationTypes.mutation = typeName; break;
      case "subscription": operationTypes.subscription = typeName; break;
    }
  }
};

const createSchemaIndex = (document: DocumentNode): SchemaIndex => {
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
          name, fields: new Map<string, FieldDefinitionNode>(), directives: [],
        }));
        addObjectFields(record.fields, definition.fields);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(inputs, definition.name.value, (name) => ({
          name, fields: new Map<string, InputValueDefinitionNode>(), directives: [],
        }));
        addInputFields(record.fields, definition.fields);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.ENUM_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(enums, definition.name.value, (name) => ({
          name, values: new Map<string, EnumValueDefinitionNode>(), directives: [],
        }));
        addEnumValues(record.values, definition.values);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.UNION_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(unions, definition.name.value, (name) => ({
          name, members: new Map<string, NamedTypeNode>(), directives: [],
        }));
        addUnionMembers(record.members, definition.types);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.SCALAR_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(scalars, definition.name.value, (name) => ({ name, directives: [] }));
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
        updateOperationTypes(operationTypes, definition);
        break;
    }
  }

  if (!operationTypes.query && objects.has("Query")) operationTypes.query = "Query";
  if (!operationTypes.mutation && objects.has("Mutation")) operationTypes.mutation = "Mutation";
  if (!operationTypes.subscription && objects.has("Subscription")) operationTypes.subscription = "Subscription";

  return { objects, inputs, enums, unions, scalars, operationTypes };
};

type TypeLevel = { readonly kind: "list" | "named"; readonly nonNull: boolean };

const collectTypeLevels = (
  type: TypeNode, nonNull = false, levels: TypeLevel[] = [],
): { readonly name: string; readonly levels: TypeLevel[] } => {
  if (type.kind === Kind.NON_NULL_TYPE) return collectTypeLevels(type.type, true, levels);
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
      modifier = level.nonNull ? "!" : "?";
      continue;
    }
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
const isUnionName = (schema: SchemaIndex, name: string): boolean => schema.unions.has(name);
const isObjectName = (schema: SchemaIndex, name: string): boolean => schema.objects.has(name);

const renderConstValue = (value: ConstValueNode): string => {
  switch (value.kind) {
    case Kind.NULL: return "null";
    case Kind.INT:
    case Kind.FLOAT: return value.value;
    case Kind.STRING:
    case Kind.ENUM: return JSON.stringify(value.value);
    case Kind.BOOLEAN: return value.value ? "true" : "false";
    case Kind.LIST: return `[${value.values.map((item) => renderConstValue(item)).join(", ")}]`;
    case Kind.OBJECT: {
      if (value.fields.length === 0) return "{}";
      const entries = value.fields.map((field) => `${field.name.value}: ${renderConstValue(field.value)}`);
      return `{ ${entries.join(", ")} }`;
    }
  }
};

const renderConstArgumentMap = (
  args: readonly { readonly name: { readonly value: string }; readonly value: ConstValueNode }[] | undefined,
): string => {
  const entries = (args ?? []).map((arg) => `${arg.name.value}: ${renderConstValue(arg.value)}`);
  return renderPropertyLines({ entries, indentSize: 6 });
};

const renderDirectives = (directives: readonly ConstDirectiveNode[] | undefined): string => {
  const entries = (directives ?? []).map(
    (directive) => `${directive.name.value}: ${renderConstArgumentMap(directive.arguments)}`,
  );
  return renderPropertyLines({ entries, indentSize: 6 });
};

const renderDefaultValue = (value: ConstValueNode | null | undefined): string =>
  value ? `() => (${renderConstValue(value)})` : "null";

const renderInputRef = (schema: SchemaIndex, definition: InputValueDefinitionNode): string => {
  const { name, modifier } = parseTypeReference(definition.type);
  const defaultValue = renderDefaultValue(definition.defaultValue ?? null);
  const directives = renderDirectives(definition.directives);
  let kind: "scalar" | "enum" | "input";
  if (isScalarName(schema, name)) kind = "scalar";
  else if (isEnumName(schema, name)) kind = "enum";
  else kind = "input";
  return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}", defaultValue: ${defaultValue}, directives: ${directives} }`;
};

const renderArgumentMap = (schema: SchemaIndex, args: readonly InputValueDefinitionNode[] | undefined): string => {
  const entries = [...(args ?? [])]
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((arg) => `${arg.name.value}: ${renderInputRef(schema, arg)}`);
  return renderPropertyLines({ entries, indentSize: 6 });
};

const renderOutputRef = (schema: SchemaIndex, type: TypeNode, args: readonly InputValueDefinitionNode[] | undefined): string => {
  const { name, modifier } = parseTypeReference(type);
  const argumentMap = renderArgumentMap(schema, args);
  let kind: "scalar" | "enum" | "union" | "object";
  if (isScalarName(schema, name)) kind = "scalar";
  else if (isEnumName(schema, name)) kind = "enum";
  else if (isUnionName(schema, name)) kind = "union";
  else if (isObjectName(schema, name)) kind = "object";
  else kind = "scalar";
  return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}", arguments: ${argumentMap} }`;
};

const renderPropertyLines = ({ entries, indentSize }: { entries: string[]; indentSize: number }) => {
  if (entries.length === 0) return "{}";
  const indent = " ".repeat(indentSize);
  const lastIndent = " ".repeat(indentSize - 2);
  return ["{", `${indent}${entries.join(`,\n${indent}`)},`, `${lastIndent}}`].join(`\n`);
};

const renderObjectFields = (schema: SchemaIndex, fields: Map<string, FieldDefinitionNode>): string => {
  const entries = Array.from(fields.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((field) => `${field.name.value}: ${renderOutputRef(schema, field.type, field.arguments)}`);
  return renderPropertyLines({ entries, indentSize: 4 });
};

const renderInputFields = (schema: SchemaIndex, fields: Map<string, InputValueDefinitionNode>): string => {
  const entries = Array.from(fields.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((field) => `${field.name.value}: ${renderInputRef(schema, field)}`);
  return renderPropertyLines({ entries, indentSize: 4 });
};

// Generate individual variable for a scalar
const renderScalarVar = (schemaName: string, record: ScalarRecord): string => {
  const typeInfo = builtinScalarTypes.get(record.name) ?? { input: "string", output: "string" };
  return `const scalar_${schemaName}_${record.name} = { name: "${record.name}", $type: {} as { input: ${typeInfo.input}; output: ${typeInfo.output}; inputProfile: { kind: "scalar"; name: "${record.name}"; value: ${typeInfo.input} }; outputProfile: { kind: "scalar"; name: "${record.name}"; value: ${typeInfo.output} } } } as const;`;
};

// Generate individual variable for an enum
const renderEnumVar = (schemaName: string, record: EnumRecord): string => {
  const valueNames = Array.from(record.values.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((value) => value.name.value);
  const valuesObj = valueNames.length === 0 ? "{}" : `{ ${valueNames.map((v) => `${v}: true`).join(", ")} }`;
  const valueUnion = valueNames.length === 0 ? "never" : valueNames.map((v) => `"${v}"`).join(" | ");
  return `const enum_${schemaName}_${record.name} = { name: "${record.name}", values: ${valuesObj}, $type: {} as { name: "${record.name}"; inputProfile: { kind: "enum"; name: "${record.name}"; value: ${valueUnion} }; outputProfile: { kind: "enum"; name: "${record.name}"; value: ${valueUnion} } } } as const;`;
};

// Generate individual variable for an input type
const renderInputVar = (schemaName: string, schema: SchemaIndex, record: InputRecord): string => {
  const fields = renderInputFields(schema, record.fields);
  return `const input_${schemaName}_${record.name} = { name: "${record.name}", fields: ${fields} } as const;`;
};

// Generate individual variable for an object type
const renderObjectVar = (schemaName: string, schema: SchemaIndex, record: ObjectRecord): string => {
  const fields = renderObjectFields(schema, record.fields);
  return `const object_${schemaName}_${record.name} = { name: "${record.name}", fields: ${fields} } as const;`;
};

// Generate individual variable for a union type
const renderUnionVar = (schemaName: string, record: UnionRecord): string => {
  const memberNames = Array.from(record.members.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((member) => member.name.value);
  const typesObj = memberNames.length === 0 ? "{}" : `{ ${memberNames.map((m) => `${m}: true`).join(", ")} }`;
  return `const union_${schemaName}_${record.name} = { name: "${record.name}", types: ${typesObj} } as const;`;
};

const collectObjectTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.objects.keys()).filter((name) => !name.startsWith("__")).sort();

const collectInputTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.inputs.keys()).filter((name) => !name.startsWith("__")).sort();

const collectEnumTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.enums.keys()).filter((name) => !name.startsWith("__")).sort();

const collectUnionTypeNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.unions.keys()).filter((name) => !name.startsWith("__")).sort();

const collectScalarNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.scalars.keys()).filter((name) => !name.startsWith("__")).sort();

const renderFragmentBuildersType = (objectTypeNames: string[], schemaName: string): string => {
  if (objectTypeNames.length === 0) return `type FragmentBuilders_${schemaName} = Record<string, never>;`;
  const entries = objectTypeNames.map(
    (name) => `  readonly ${name}: FragmentBuilderFor<Schema_${schemaName}, "${name}">`,
  );
  return `type FragmentBuilders_${schemaName} = {\n${entries.join(";\n")};\n};`;
};

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

/**
 * Granular multi-schema module generator
 *
 * Each individual type is generated as its own const variable,
 * then assembled into category objects via references.
 */
export const generateMultiSchemaModuleGranular = (
  schemas: Map<string, DocumentNode>,
): GeneratedModule => {
  const allStats = { objects: 0, enums: 0, inputs: 0, unions: 0 };
  const schemaBlocks: string[] = [];
  const gqlEntries: string[] = [];

  for (const [name, document] of schemas.entries()) {
    const schema = createSchemaIndex(document);

    // Collect type names
    const objectTypeNames = collectObjectTypeNames(schema);
    const enumTypeNames = collectEnumTypeNames(schema);
    const inputTypeNames = collectInputTypeNames(schema);
    const unionTypeNames = collectUnionTypeNames(schema);
    const scalarNames = collectScalarNames(schema);

    // Generate individual variables for each type
    const scalarVars: string[] = [];
    const enumVars: string[] = [];
    const inputVars: string[] = [];
    const objectVars: string[] = [];
    const unionVars: string[] = [];

    // Builtin scalars
    for (const scalarName of builtinScalarTypes.keys()) {
      const record = schema.scalars.get(scalarName) ?? { name: scalarName, directives: [] };
      scalarVars.push(renderScalarVar(name, record));
    }

    // Custom scalars
    for (const scalarName of scalarNames.filter((n) => !builtinScalarTypes.has(n))) {
      const record = schema.scalars.get(scalarName);
      if (record) scalarVars.push(renderScalarVar(name, record));
    }

    // Enums
    for (const enumName of enumTypeNames) {
      const record = schema.enums.get(enumName);
      if (record) enumVars.push(renderEnumVar(name, record));
    }

    // Inputs
    for (const inputName of inputTypeNames) {
      const record = schema.inputs.get(inputName);
      if (record) inputVars.push(renderInputVar(name, schema, record));
    }

    // Objects
    for (const objectName of objectTypeNames) {
      const record = schema.objects.get(objectName);
      if (record) objectVars.push(renderObjectVar(name, schema, record));
    }

    // Unions
    for (const unionName of unionTypeNames) {
      const record = schema.unions.get(unionName);
      if (record) unionVars.push(renderUnionVar(name, record));
    }

    // Generate assembly references
    const allScalarNames = [...builtinScalarTypes.keys(), ...scalarNames.filter((n) => !builtinScalarTypes.has(n))];
    const scalarAssembly = allScalarNames.map((n) => `${n}: scalar_${name}_${n}`).join(", ");
    const enumAssembly = enumTypeNames.map((n) => `${n}: enum_${name}_${n}`).join(", ");
    const inputAssembly = inputTypeNames.map((n) => `${n}: input_${name}_${n}`).join(", ");
    const objectAssembly = objectTypeNames.map((n) => `${n}: object_${name}_${n}`).join(", ");
    const unionAssembly = unionTypeNames.map((n) => `${n}: union_${name}_${n}`).join(", ");

    const factoryVar = `createMethod_${name}`;
    const inputTypeMethodsBlock = renderInputTypeMethods(schema, factoryVar);
    const fragmentBuildersTypeBlock = renderFragmentBuildersType(objectTypeNames, name);

    const queryType = schema.operationTypes.query ?? "Query";
    const mutationType = schema.operationTypes.mutation ?? "Mutation";
    const subscriptionType = schema.operationTypes.subscription ?? "Subscription";

    schemaBlocks.push(`
// ============================================================
// Schema: ${name} (Granular - ${scalarVars.length + enumVars.length + inputVars.length + objectVars.length + unionVars.length} individual type variables)
// ============================================================

// Individual scalar definitions
${scalarVars.join("\n")}

// Individual enum definitions
${enumVars.join("\n")}

// Individual input definitions
${inputVars.join("\n")}

// Individual object definitions
${objectVars.join("\n")}

// Individual union definitions
${unionVars.length > 0 ? unionVars.join("\n") : "// (no unions)"}

// Category assembly - references only
const scalar_${name} = { ${scalarAssembly} } as const;
const enum_${name} = { ${enumAssembly} } as const;
const input_${name} = { ${inputAssembly} } as const;
const object_${name} = { ${objectAssembly} } as const;
const union_${name} = { ${unionAssembly || ""} } as const;

// Schema assembly
const ${name}Schema = {
  label: "${name}" as const,
  operations: { query: "${queryType}", mutation: "${mutationType}", subscription: "${subscriptionType}" } as const,
  scalar: scalar_${name},
  enum: enum_${name},
  input: input_${name},
  object: object_${name},
  union: union_${name},
};

const ${factoryVar} = createVarMethodFactory<typeof ${name}Schema>();
const inputTypeMethods_${name} = ${inputTypeMethodsBlock};

export type Schema_${name} = typeof ${name}Schema & { _?: never };
${fragmentBuildersTypeBlock}`);

    gqlEntries.push(
      `  ${name}: createGqlElementComposer<Schema_${name}, FragmentBuilders_${name}>(${name}Schema, { inputTypeMethods: inputTypeMethods_${name} })`,
    );

    allStats.objects += objectVars.length;
    allStats.enums += enumVars.length;
    allStats.inputs += inputVars.length;
    allStats.unions += unionVars.length;
  }

  const code = `\
import {
  type ExtractMetadataAdapter,
  type FragmentBuilderFor,
  createGqlElementComposer,
  createVarMethodFactory,
} from "@soda-gql/core";
${schemaBlocks.join("\n")}

export const gql = {
${gqlEntries.join(",\n")}
};
`;

  return { code, stats: allStats };
};
