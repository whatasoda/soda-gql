import type { TypeCategory, TypeFilterConfig } from "@soda-gql/config";
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

import type { CategoryVars, DefinitionVar } from "./defs-generator";
import { buildExclusionSet, compileTypeFilter } from "./type-filter";

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

type DirectiveRecord = {
  readonly name: string;
  readonly locations: readonly string[];
  readonly args: Map<string, InputValueDefinitionNode>;
  readonly isRepeatable: boolean;
};

type SchemaIndex = {
  readonly objects: Map<string, ObjectRecord>;
  readonly inputs: Map<string, InputRecord>;
  readonly enums: Map<string, EnumRecord>;
  readonly unions: Map<string, UnionRecord>;
  readonly scalars: Map<string, ScalarRecord>;
  readonly directives: Map<string, DirectiveRecord>;
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

const addDirectiveArgs = (
  target: Map<string, InputValueDefinitionNode>,
  args: readonly InputValueDefinitionNode[] | undefined,
): void => {
  if (!args) {
    return;
  }
  for (const arg of args) {
    target.set(arg.name.value, arg);
  }
};

export const createSchemaIndex = (document: DocumentNode): SchemaIndex => {
  const objects = new Map<string, ObjectRecord>();
  const inputs = new Map<string, InputRecord>();
  const enums = new Map<string, EnumRecord>();
  const unions = new Map<string, UnionRecord>();
  const scalars = new Map<string, ScalarRecord>();
  const directives = new Map<string, DirectiveRecord>();
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
      case Kind.DIRECTIVE_DEFINITION: {
        // Skip built-in directives that are already provided by createStandardDirectives
        const name = definition.name.value;
        if (name === "skip" || name === "include" || name === "deprecated" || name === "specifiedBy") {
          break;
        }
        const args = new Map<string, InputValueDefinitionNode>();
        addDirectiveArgs(args, definition.arguments);
        directives.set(name, {
          name,
          locations: definition.locations.map((loc) => loc.value),
          args,
          isRepeatable: definition.repeatable,
        });
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
    directives,
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

/**
 * Maps type kind to deferred specifier prefix character.
 */
const inputKindToChar = (kind: "scalar" | "enum" | "input" | "excluded"): string => {
  switch (kind) {
    case "scalar":
      return "s";
    case "enum":
      return "e";
    case "input":
      return "i";
    case "excluded":
      return "x"; // excluded types use 'x' prefix
  }
};

const renderInputRef = (schema: SchemaIndex, definition: InputValueDefinitionNode, excluded: Set<string>): string => {
  const { name, modifier } = parseTypeReference(definition.type);
  const defaultValue = definition.defaultValue;

  // Check if referenced type is excluded
  if (excluded.has(name)) {
    // Excluded types still use structured format for now (they're filtered out)
    if (defaultValue) {
      return `{ kind: "excluded", name: "${name}", modifier: "${modifier}", defaultValue: { default: ${renderConstValue(defaultValue)} } }`;
    }
    return `{ kind: "excluded", name: "${name}", modifier: "${modifier}" }`;
  }

  let kind: "scalar" | "enum" | "input";
  if (isScalarName(schema, name)) {
    kind = "scalar";
  } else if (isEnumName(schema, name)) {
    kind = "enum";
  } else {
    kind = "input";
  }

  // Generate deferred string specifier format: "{kindChar}|{name}|{modifier}[|D]"
  const kindChar = inputKindToChar(kind);
  const defaultSuffix = defaultValue ? "|D" : "";
  return `"${kindChar}|${name}|${modifier}${defaultSuffix}"`;
};

/**
 * Maps output type kind to deferred specifier prefix character.
 */
const outputKindToChar = (kind: "scalar" | "enum" | "union" | "object" | "excluded"): string => {
  switch (kind) {
    case "scalar":
      return "s";
    case "enum":
      return "e";
    case "object":
      return "o";
    case "union":
      return "u";
    case "excluded":
      return "x"; // excluded types use 'x' prefix
  }
};

/**
 * Render arguments as object format for DeferredOutputFieldWithArgs.
 * Returns array of "argName: \"spec\"" entries.
 */
const renderArgumentsObjectEntries = (
  schema: SchemaIndex,
  args: readonly InputValueDefinitionNode[],
  excluded: Set<string>,
): string[] => {
  return [...args]
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((arg) => {
      const { name, modifier } = parseTypeReference(arg.type);
      // Skip excluded types - they shouldn't appear in field arguments
      if (excluded.has(name)) {
        return null;
      }
      let kind: "scalar" | "enum" | "input";
      if (isScalarName(schema, name)) {
        kind = "scalar";
      } else if (isEnumName(schema, name)) {
        kind = "enum";
      } else {
        kind = "input";
      }
      const kindChar = inputKindToChar(kind);
      const defaultSuffix = arg.defaultValue ? "|D" : "";
      return `${arg.name.value}: "${kindChar}|${name}|${modifier}${defaultSuffix}"`;
    })
    .filter((spec): spec is string => spec !== null);
};

const renderArgumentMap = (
  schema: SchemaIndex,
  args: readonly InputValueDefinitionNode[] | undefined,
  excluded: Set<string>,
): string => {
  const entries = [...(args ?? [])]
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((arg) => `${arg.name.value}: ${renderInputRef(schema, arg, excluded)}`);

  return renderPropertyLines({ entries, indentSize: 8 });
};

const renderOutputRef = (
  schema: SchemaIndex,
  type: TypeNode,
  args: readonly InputValueDefinitionNode[] | undefined,
  excluded: Set<string>,
): string => {
  const { name, modifier } = parseTypeReference(type);

  // Check if referenced type is excluded
  if (excluded.has(name)) {
    const argumentMap = renderArgumentMap(schema, args, excluded);
    return `{ kind: "excluded", name: "${name}", modifier: "${modifier}", arguments: ${argumentMap} }`;
  }

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

  const kindChar = outputKindToChar(kind);
  const spec = `${kindChar}|${name}|${modifier}`;

  // Always use object format for consistency (avoids union type distribution issues)
  if (args && args.length > 0) {
    const argEntries = renderArgumentsObjectEntries(schema, args, excluded);
    if (argEntries.length > 0) {
      return `{ spec: "${spec}", arguments: { ${argEntries.join(", ")} } }`;
    }
  }

  // Fields without arguments still use object format with empty arguments
  return `{ spec: "${spec}", arguments: {} }`;
};

const renderPropertyLines = ({ entries, indentSize }: { entries: string[]; indentSize: number }) => {
  if (entries.length === 0) {
    return "{}";
  }

  const indent = " ".repeat(indentSize);
  const lastIndent = " ".repeat(indentSize - 2);
  return ["{", `${indent}${entries.join(`,\n${indent}`)},`, `${lastIndent}}`].join(`\n`);
};

const renderObjectFields = (schema: SchemaIndex, fields: Map<string, FieldDefinitionNode>, excluded: Set<string>): string => {
  const entries = Array.from(fields.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((field) => `${field.name.value}: ${renderOutputRef(schema, field.type, field.arguments, excluded)}`);

  return renderPropertyLines({ entries, indentSize: 6 });
};

const renderInputFields = (schema: SchemaIndex, fields: Map<string, InputValueDefinitionNode>, excluded: Set<string>): string => {
  const entries = Array.from(fields.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((field) => `${field.name.value}: ${renderInputRef(schema, field, excluded)}`);

  return renderPropertyLines({ entries, indentSize: 6 });
};

// Granular render functions - each type as its own const variable
const renderScalarVar = (schemaName: string, record: ScalarRecord): string => {
  const typeInfo = builtinScalarTypes.get(record.name) ?? { input: "string", output: "string" };
  return `const scalar_${schemaName}_${record.name} = { name: "${record.name}", $type: {} as { input: ${typeInfo.input}; output: ${typeInfo.output}; inputProfile: { kind: "scalar"; name: "${record.name}"; value: ${typeInfo.input} }; outputProfile: { kind: "scalar"; name: "${record.name}"; value: ${typeInfo.output} } } } as const;`;
};

const renderEnumVar = (schemaName: string, record: EnumRecord): string => {
  const valueNames = Array.from(record.values.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((value) => value.name.value);
  const valuesObj = valueNames.length === 0 ? "{}" : `{ ${valueNames.map((v) => `${v}: true`).join(", ")} }`;
  const valueUnion = valueNames.length === 0 ? "never" : valueNames.map((v) => `"${v}"`).join(" | ");
  return `const enum_${schemaName}_${record.name} = defineEnum<"${record.name}", ${valueUnion}>("${record.name}", ${valuesObj});`;
};

const renderInputVar = (schemaName: string, schema: SchemaIndex, record: InputRecord, excluded: Set<string>): string => {
  const fields = renderInputFields(schema, record.fields, excluded);
  return `const input_${schemaName}_${record.name} = { name: "${record.name}", fields: ${fields} } as const;`;
};

const renderObjectVar = (schemaName: string, schema: SchemaIndex, record: ObjectRecord, excluded: Set<string>): string => {
  const fields = renderObjectFields(schema, record.fields, excluded);
  return `const object_${schemaName}_${record.name} = { name: "${record.name}", fields: ${fields} } as const;`;
};

const renderUnionVar = (schemaName: string, record: UnionRecord, excluded: Set<string>): string => {
  const memberNames = Array.from(record.members.values())
    .filter((member) => !excluded.has(member.name.value))
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((member) => member.name.value);
  const typesObj = memberNames.length === 0 ? "{}" : `{ ${memberNames.map((m) => `${m}: true`).join(", ")} }`;
  return `const union_${schemaName}_${record.name} = { name: "${record.name}", types: ${typesObj} } as const;`;
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

const collectDirectiveNames = (schema: SchemaIndex): string[] =>
  Array.from(schema.directives.keys()).sort((left, right) => left.localeCompare(right));

const renderInputTypeMethod = (factoryVar: string, kind: "scalar" | "enum" | "input", typeName: string): string =>
  `${typeName}: ${factoryVar}("${kind}", "${typeName}")`;

const renderInputTypeMethods = (schema: SchemaIndex, factoryVar: string, excluded: Set<string>): string => {
  const scalarMethods = Array.from(builtinScalarTypes.keys())
    .concat(collectScalarNames(schema).filter((name) => !builtinScalarTypes.has(name)))
    .filter((name) => !excluded.has(name))
    .map((name) => renderInputTypeMethod(factoryVar, "scalar", name));

  const enumMethods = collectEnumTypeNames(schema)
    .filter((name) => !excluded.has(name))
    .map((name) => renderInputTypeMethod(factoryVar, "enum", name));

  const inputMethods = collectInputTypeNames(schema)
    .filter((name) => !excluded.has(name))
    .map((name) => renderInputTypeMethod(factoryVar, "input", name));

  const allMethods = [...scalarMethods, ...enumMethods, ...inputMethods].sort((left, right) => {
    const leftName = left.split(":")[0] ?? "";
    const rightName = right.split(":")[0] ?? "";
    return leftName.localeCompare(rightName);
  });

  return renderPropertyLines({ entries: allMethods, indentSize: 2 });
};

/**
 * Renders an input reference as a deferred string for directive arguments.
 * Format: "{kindChar}|{name}|{modifier}"
 */
const renderDeferredDirectiveArgRef = (
  schema: SchemaIndex,
  definition: InputValueDefinitionNode,
  excluded: Set<string>,
): string | null => {
  const { name, modifier } = parseTypeReference(definition.type);

  // Skip excluded types
  if (excluded.has(name)) {
    return null;
  }

  let kind: "scalar" | "enum" | "input";
  if (isScalarName(schema, name)) {
    kind = "scalar";
  } else if (isEnumName(schema, name)) {
    kind = "enum";
  } else {
    kind = "input";
  }

  const kindChar = inputKindToChar(kind);
  return `"${kindChar}|${name}|${modifier}"`;
};

/**
 * Renders argument specifiers for a directive.
 * Returns null if the directive has no arguments.
 * Uses deferred string format for consistency with other type specifiers.
 */
const renderDirectiveArgsSpec = (
  schema: SchemaIndex,
  args: Map<string, InputValueDefinitionNode>,
  excluded: Set<string>,
): string | null => {
  if (args.size === 0) return null;

  const entries = Array.from(args.values())
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map((arg) => {
      const ref = renderDeferredDirectiveArgRef(schema, arg, excluded);
      return ref ? `${arg.name.value}: ${ref}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  if (entries.length === 0) return null;

  return renderPropertyLines({ entries, indentSize: 4 });
};

const renderDirectiveMethod = (schema: SchemaIndex, record: DirectiveRecord, excluded: Set<string>): string => {
  const locationsJson = JSON.stringify(record.locations);
  const argsSpec = renderDirectiveArgsSpec(schema, record.args, excluded);

  if (argsSpec === null) {
    // No arguments - use simple createDirectiveMethod
    return `${record.name}: createDirectiveMethod("${record.name}", ${locationsJson} as const)`;
  }

  // With arguments - use createTypedDirectiveMethod
  return `${record.name}: createTypedDirectiveMethod("${record.name}", ${locationsJson} as const, ${argsSpec})`;
};

const renderDirectiveMethods = (schema: SchemaIndex, excluded: Set<string>): string => {
  const directiveNames = collectDirectiveNames(schema);
  if (directiveNames.length === 0) {
    return "{}";
  }

  const methods = directiveNames
    .map((name) => {
      const record = schema.directives.get(name);
      return record ? renderDirectiveMethod(schema, record, excluded) : null;
    })
    .filter((method): method is string => method !== null);

  return renderPropertyLines({ entries: methods, indentSize: 2 });
};

export type DefsFile = {
  readonly relativePath: string;
  readonly content: string;
};

export type GeneratedModule = {
  readonly code: string;
  readonly injectsCode?: string;
  readonly defsFiles?: readonly DefsFile[];
  readonly categoryVars?: Record<string, CategoryVars>;
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
      readonly injectsModulePath: string;
    };

export type RuntimeGenerationOptions = {
  readonly injection?: Map<string, PerSchemaInjection>;
  readonly defaultInputDepth?: Map<string, number>;
  readonly inputDepthOverrides?: Map<string, Readonly<Record<string, number>>>;
  readonly chunkSize?: number;
  readonly typeFilters?: Map<string, TypeFilterConfig>;
};

type SplittingMode = {
  readonly importPaths: {
    readonly enums: string;
    readonly inputs: string;
    readonly objects: string;
    readonly unions: string;
  };
};

type MultiRuntimeTemplateOptions = {
  readonly schemas: Record<
    string,
    {
      readonly queryType: string;
      readonly mutationType: string;
      readonly subscriptionType: string;
      // Granular: individual variable declarations
      readonly scalarVars: string[];
      readonly enumVars: string[];
      readonly inputVars: string[];
      readonly objectVars: string[];
      readonly unionVars: string[];
      // Granular: type name lists for assembly
      readonly scalarNames: string[];
      readonly enumNames: string[];
      readonly inputNames: string[];
      readonly objectNames: string[];
      readonly unionNames: string[];
      readonly inputTypeMethodsBlock: string;
      readonly directiveMethodsBlock: string;
      readonly fragmentBuildersTypeBlock: string;
      readonly defaultInputDepth?: number;
      readonly inputDepthOverrides?: Readonly<Record<string, number>>;
    }
  >;
  readonly injection: RuntimeTemplateInjection;
  readonly splitting: SplittingMode;
};

/**
 * Generates the _internal-injects.ts module code.
 * This file contains only adapter imports (scalar, adapter) to keep it lightweight.
 * The heavy schema types remain in _internal.ts.
 */
const generateInjectsCode = (injection: Map<string, PerSchemaInjection>): string => {
  const imports: string[] = [];
  const exports: string[] = [];
  const typeExports: string[] = [];

  // Group imports by file path
  const importsByPath = new Map<string, string[]>();

  for (const [schemaName, config] of injection) {
    const scalarAlias = `scalar_${schemaName}`;

    // Group scalar import
    const scalarSpecifiers = importsByPath.get(config.scalarImportPath) ?? [];
    if (!importsByPath.has(config.scalarImportPath)) {
      importsByPath.set(config.scalarImportPath, scalarSpecifiers);
    }
    scalarSpecifiers.push(`scalar as ${scalarAlias}`);

    exports.push(`export { ${scalarAlias} };`);
    typeExports.push(`export type Scalar_${schemaName} = typeof ${scalarAlias};`);

    // Group adapter import (optional)
    if (config.adapterImportPath) {
      const adapterAlias = `adapter_${schemaName}`;
      const adapterSpecifiers = importsByPath.get(config.adapterImportPath) ?? [];
      if (!importsByPath.has(config.adapterImportPath)) {
        importsByPath.set(config.adapterImportPath, adapterSpecifiers);
      }
      adapterSpecifiers.push(`adapter as ${adapterAlias}`);

      exports.push(`export { ${adapterAlias} };`);
      typeExports.push(`export type Adapter_${schemaName} = typeof ${adapterAlias} & { _?: never };`);
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

  return `\
/**
 * Adapter injections for schema.
 * Separated to allow lightweight imports for prebuilt module.
 * @generated by @soda-gql/codegen
 */

${imports.join("\n")}

// Value exports
${exports.join("\n")}

// Type exports
${typeExports.join("\n")}
`;
};

const multiRuntimeTemplate = ($$: MultiRuntimeTemplateOptions) => {
  // Build imports based on injection mode
  const imports: string[] = [];
  const scalarAliases = new Map<string, string>();
  const adapterAliases = new Map<string, string>();

  if ($$.injection.mode === "inject") {
    // Import from _internal-injects.ts instead of individual files
    const injectsImports: string[] = [];

    for (const [schemaName, injection] of $$.injection.perSchema) {
      const scalarAlias = `scalar_${schemaName}`;
      scalarAliases.set(schemaName, scalarAlias);
      injectsImports.push(scalarAlias);

      if (injection.adapterImportPath) {
        const adapterAlias = `adapter_${schemaName}`;
        adapterAliases.set(schemaName, adapterAlias);
        injectsImports.push(adapterAlias);
      }
    }

    imports.push(`import { ${injectsImports.join(", ")} } from "${$$.injection.injectsModulePath}";`);
  }

  // Build imports for split mode (always enabled)
  {
    const { importPaths } = $$.splitting;
    for (const [name, config] of Object.entries($$.schemas)) {
      // Import enums (if any)
      if (config.enumNames.length > 0) {
        const enumImports = config.enumNames.map((n) => `enum_${name}_${n}`).join(", ");
        imports.push(`import { ${enumImports} } from "${importPaths.enums}";`);
      }
      // Import inputs (if any)
      if (config.inputNames.length > 0) {
        const inputImports = config.inputNames.map((n) => `input_${name}_${n}`).join(", ");
        imports.push(`import { ${inputImports} } from "${importPaths.inputs}";`);
      }
      // Import objects (if any)
      if (config.objectNames.length > 0) {
        const objectImports = config.objectNames.map((n) => `object_${name}_${n}`).join(", ");
        imports.push(`import { ${objectImports} } from "${importPaths.objects}";`);
      }
      // Import unions (if any)
      if (config.unionNames.length > 0) {
        const unionImports = config.unionNames.map((n) => `union_${name}_${n}`).join(", ");
        imports.push(`import { ${unionImports} } from "${importPaths.unions}";`);
      }
    }
  }

  const extraImports = imports.length > 0 ? `${imports.join("\n")}\n` : "";

  // Generate per-schema definitions (granular pattern)
  const schemaBlocks: string[] = [];
  const gqlEntries: string[] = [];

  for (const [name, config] of Object.entries($$.schemas)) {
    const schemaVar = `${name}Schema`;

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
    const customDirectivesVar = `customDirectives_${name}`;

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

    // Always in split mode
    const isSplitMode = true;

    // Granular: generate individual variable declarations (skip in split mode - they're imported)
    // Note: Scalars are never split - they're either injected or inlined
    const scalarVarsBlock = config.scalarVars.join("\n");
    const enumVarsBlock = isSplitMode
      ? "// (enums imported)"
      : config.enumVars.length > 0
        ? config.enumVars.join("\n")
        : "// (no enums)";
    const inputVarsBlock = isSplitMode
      ? "// (inputs imported)"
      : config.inputVars.length > 0
        ? config.inputVars.join("\n")
        : "// (no inputs)";
    const objectVarsBlock = isSplitMode
      ? "// (objects imported)"
      : config.objectVars.length > 0
        ? config.objectVars.join("\n")
        : "// (no objects)";
    const unionVarsBlock = isSplitMode
      ? "// (unions imported)"
      : config.unionVars.length > 0
        ? config.unionVars.join("\n")
        : "// (no unions)";

    // Granular: generate assembly references
    // For injection mode, use imported scalar object; otherwise assemble from individual vars
    const scalarAssembly =
      $$.injection.mode === "inject"
        ? (scalarAliases.get(name) ?? "{}")
        : config.scalarNames.length > 0
          ? `{ ${config.scalarNames.map((n) => `${n}: scalar_${name}_${n}`).join(", ")} }`
          : "{}";
    const enumAssembly =
      config.enumNames.length > 0 ? `{ ${config.enumNames.map((n) => `${n}: enum_${name}_${n}`).join(", ")} }` : "{}";
    const inputAssembly =
      config.inputNames.length > 0 ? `{ ${config.inputNames.map((n) => `${n}: input_${name}_${n}`).join(", ")} }` : "{}";
    const objectAssembly =
      config.objectNames.length > 0 ? `{ ${config.objectNames.map((n) => `${n}: object_${name}_${n}`).join(", ")} }` : "{}";
    const unionAssembly =
      config.unionNames.length > 0 ? `{ ${config.unionNames.map((n) => `${n}: union_${name}_${n}`).join(", ")} }` : "{}";

    // Granular: skip individual scalar vars when using injection (scalars come from import)
    // Note: Even in split mode, scalars are inlined unless injection is used
    const scalarVarsSection = $$.injection.mode === "inject" ? "// (scalars imported)" : scalarVarsBlock;

    // When injecting scalars, use the imported alias directly; otherwise use the assembled category object
    const scalarAssemblyLine =
      $$.injection.mode === "inject"
        ? `// scalar_${name} is imported directly`
        : `const scalar_${name} = ${scalarAssembly} as const;`;
    const scalarRef = $$.injection.mode === "inject" ? (scalarAliases.get(name) ?? `scalar_${name}`) : `scalar_${name}`;

    schemaBlocks.push(`
// Individual scalar definitions
${scalarVarsSection}

// Individual enum definitions
${enumVarsBlock}

// Individual input definitions
${inputVarsBlock}

// Individual object definitions
${objectVarsBlock}

// Individual union definitions
${unionVarsBlock}

// Category assembly
${scalarAssemblyLine}
const enum_${name} = ${enumAssembly} as const;
const input_${name} = ${inputAssembly} as const;
const object_${name} = ${objectAssembly} as const;
const union_${name} = ${unionAssembly} as const;

// Schema assembly
const ${schemaVar} = {
  label: "${name}" as const,
  operations: { query: "${config.queryType}", mutation: "${config.mutationType}", subscription: "${config.subscriptionType}" } as const,
  scalar: ${scalarRef},
  enum: enum_${name},
  input: input_${name},
  object: object_${name},
  union: union_${name},${defaultDepthBlock}${depthOverridesBlock}
} as const satisfies AnyGraphqlSchema;

const ${factoryVar} = createVarMethodFactory<typeof ${schemaVar}>();
const ${inputTypeMethodsVar} = ${config.inputTypeMethodsBlock};
const ${customDirectivesVar} = { ...createStandardDirectives(), ...${config.directiveMethodsBlock} };

${typeExports.join("\n")}`);

    // Build gql composer as a named variable for Context type extraction
    const gqlVarName = `gql_${name}`;
    if (adapterVar) {
      const typeParams = `<Schema_${name}, FragmentBuilders_${name}, typeof ${customDirectivesVar}, Adapter_${name}>`;
      schemaBlocks.push(
        `const ${gqlVarName} = createGqlElementComposer${typeParams}(${schemaVar}, { adapter: ${adapterVar}, inputTypeMethods: ${inputTypeMethodsVar}, directiveMethods: ${customDirectivesVar} });`,
      );
    } else {
      const typeParams = `<Schema_${name}, FragmentBuilders_${name}, typeof ${customDirectivesVar}>`;
      schemaBlocks.push(
        `const ${gqlVarName} = createGqlElementComposer${typeParams}(${schemaVar}, { inputTypeMethods: ${inputTypeMethodsVar}, directiveMethods: ${customDirectivesVar} });`,
      );
    }

    // Export Context type extracted from the gql composer
    schemaBlocks.push(
      `export type Context_${name} = Parameters<typeof ${gqlVarName}>[0] extends (ctx: infer C) => unknown ? C : never;`,
    );

    // Prebuilt module exports (for typegen)
    const prebuiltExports: string[] = [
      `export { ${schemaVar} as __schema_${name} }`,
      `export { ${inputTypeMethodsVar} as __inputTypeMethods_${name} }`,
      `export { ${customDirectivesVar} as __directiveMethods_${name} }`,
    ];
    if (adapterVar) {
      prebuiltExports.push(`export { ${adapterVar} as __adapter_${name} }`);
    }
    schemaBlocks.push(`${prebuiltExports.join(";\n")};`);

    gqlEntries.push(`  ${name}: ${gqlVarName}`);
  }

  // In split mode (always on), we don't need defineEnum in _internal.ts since enums are defined in _defs/enums.ts
  const needsDefineEnum = false;

  return `\
import {${needsDefineEnum ? "\n  defineEnum," : ""}
  type ExtractMetadataAdapter,
  type FragmentBuilderFor,
  type AnyGraphqlSchema,
  createDirectiveMethod,
  createTypedDirectiveMethod,
  createGqlElementComposer,
  createStandardDirectives,
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

    // Build type filter for this schema
    const typeFilterConfig = options?.typeFilters?.get(name);
    const typeFilter = compileTypeFilter(typeFilterConfig);

    // Collect all type names for exclusion set building
    const allTypeNames = new Map<TypeCategory, readonly string[]>([
      ["object", Array.from(schema.objects.keys()).filter((n) => !n.startsWith("__"))],
      ["input", Array.from(schema.inputs.keys()).filter((n) => !n.startsWith("__"))],
      ["enum", Array.from(schema.enums.keys()).filter((n) => !n.startsWith("__"))],
      ["union", Array.from(schema.unions.keys()).filter((n) => !n.startsWith("__"))],
      ["scalar", Array.from(schema.scalars.keys()).filter((n) => !n.startsWith("__"))],
    ]);

    // Build exclusion set
    const excluded = buildExclusionSet(typeFilter, allTypeNames);

    // Collect type names (filtered)
    const objectTypeNames = collectObjectTypeNames(schema).filter((n) => !excluded.has(n));
    const enumTypeNames = collectEnumTypeNames(schema).filter((n) => !excluded.has(n));
    const inputTypeNames = collectInputTypeNames(schema).filter((n) => !excluded.has(n));
    const unionTypeNames = collectUnionTypeNames(schema).filter((n) => !excluded.has(n));
    const customScalarNames = collectScalarNames(schema).filter((n) => !builtinScalarTypes.has(n) && !excluded.has(n));

    // Generate individual variable declarations (granular pattern)
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
    for (const scalarName of customScalarNames) {
      const record = schema.scalars.get(scalarName);
      if (record) {
        scalarVars.push(renderScalarVar(name, record));
      }
    }

    // Enums
    for (const enumName of enumTypeNames) {
      const record = schema.enums.get(enumName);
      if (record) {
        enumVars.push(renderEnumVar(name, record));
      }
    }

    // Inputs
    for (const inputName of inputTypeNames) {
      const record = schema.inputs.get(inputName);
      if (record) {
        inputVars.push(renderInputVar(name, schema, record, excluded));
      }
    }

    // Objects
    for (const objectName of objectTypeNames) {
      const record = schema.objects.get(objectName);
      if (record) {
        objectVars.push(renderObjectVar(name, schema, record, excluded));
      }
    }

    // Unions
    for (const unionName of unionTypeNames) {
      const record = schema.unions.get(unionName);
      if (record) {
        unionVars.push(renderUnionVar(name, record, excluded));
      }
    }

    // Type name lists for assembly
    const allScalarNames = [...builtinScalarTypes.keys(), ...customScalarNames];

    const factoryVar = `createMethod_${name}`;
    const inputTypeMethodsBlock = renderInputTypeMethods(schema, factoryVar, excluded);
    const directiveMethodsBlock = renderDirectiveMethods(schema, excluded);
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
      // Granular: individual variable declarations
      scalarVars,
      enumVars,
      inputVars,
      objectVars,
      unionVars,
      // Granular: type name lists for assembly
      scalarNames: allScalarNames,
      enumNames: enumTypeNames,
      inputNames: inputTypeNames,
      objectNames: objectTypeNames,
      unionNames: unionTypeNames,
      inputTypeMethodsBlock,
      directiveMethodsBlock,
      fragmentBuildersTypeBlock,
      defaultInputDepth: options?.defaultInputDepth?.get(name),
      inputDepthOverrides: options?.inputDepthOverrides?.get(name),
    };

    // Accumulate stats
    allStats.objects += objectVars.length;
    allStats.enums += enumVars.length;
    allStats.inputs += inputVars.length;
    allStats.unions += unionVars.length;
  }

  const injection: RuntimeTemplateInjection = options?.injection
    ? { mode: "inject", perSchema: options.injection, injectsModulePath: "./_internal-injects" }
    : { mode: "inline" };

  // Always use split mode
  const splitting: SplittingMode = {
    importPaths: {
      enums: "./_defs/enums",
      inputs: "./_defs/inputs",
      objects: "./_defs/objects",
      unions: "./_defs/unions",
    },
  };

  const code = multiRuntimeTemplate({
    schemas: schemaConfigs,
    injection,
    splitting,
  });

  // Generate injects code if in inject mode
  const injectsCode = options?.injection ? generateInjectsCode(options.injection) : undefined;

  // Always build categoryVars (splitting is always enabled)
  const categoryVarsResult: Record<string, CategoryVars> = Object.fromEntries(
    Object.entries(schemaConfigs).map(([schemaName, config]) => {
      const toDefVar = (code: string, prefix: string): DefinitionVar => {
        // Extract name from "const {prefix}_{schemaName}_{name} = ..."
        const match = code.match(new RegExp(`const (${prefix}_${schemaName}_(\\w+))`));
        return {
          name: match?.[1] ?? "",
          code,
        };
      };

      return [
        schemaName,
        {
          enums: (config.enumVars as string[]).map((c) => toDefVar(c, "enum")),
          inputs: (config.inputVars as string[]).map((c) => toDefVar(c, "input")),
          objects: (config.objectVars as string[]).map((c) => toDefVar(c, "object")),
          unions: (config.unionVars as string[]).map((c) => toDefVar(c, "union")),
        } satisfies CategoryVars,
      ];
    }),
  );

  return {
    code,
    injectsCode,
    categoryVars: categoryVarsResult,
    stats: allStats,
  };
};
