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

const renderInputRef = (schema: SchemaIndex, definition: InputValueDefinitionNode): string => {
  const { name, modifier } = parseTypeReference(definition.type);
  const defaultValue = definition.defaultValue;

  let kind: "scalar" | "enum" | "input";
  if (isScalarName(schema, name)) {
    kind = "scalar";
  } else if (isEnumName(schema, name)) {
    kind = "enum";
  } else {
    kind = "input";
  }

  // Only include defaultValue when it has a value (reduces file size significantly)
  if (defaultValue) {
    return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}", defaultValue: { default: ${renderConstValue(defaultValue)} } }`;
  }
  return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}" }`;
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

const renderInputVar = (schemaName: string, schema: SchemaIndex, record: InputRecord): string => {
  const fields = renderInputFields(schema, record.fields);
  return `const input_${schemaName}_${record.name} = { name: "${record.name}", fields: ${fields} } as const;`;
};

const renderObjectVar = (schemaName: string, schema: SchemaIndex, record: ObjectRecord): string => {
  const fields = renderObjectFields(schema, record.fields);
  return `const object_${schemaName}_${record.name} = { name: "${record.name}", fields: ${fields} } as const;`;
};

const renderUnionVar = (schemaName: string, record: UnionRecord): string => {
  const memberNames = Array.from(record.members.values())
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

const renderDirectiveMethod = (record: DirectiveRecord): string => {
  const locationsJson = JSON.stringify(record.locations);
  return `${record.name}: createDirectiveMethod("${record.name}", ${locationsJson} as const)`;
};

const renderDirectiveMethods = (schema: SchemaIndex): string => {
  const directiveNames = collectDirectiveNames(schema);
  if (directiveNames.length === 0) {
    return "{}";
  }

  const methods = directiveNames
    .map((name) => {
      const record = schema.directives.get(name);
      return record ? renderDirectiveMethod(record) : null;
    })
    .filter((method): method is string => method !== null);

  return renderPropertyLines({ entries: methods, indentSize: 2 });
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
  /** Export schema internals for prebuilt module consumption. */
  readonly exportForPrebuilt?: boolean;
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
  readonly exportForPrebuilt?: boolean;
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

    // Granular: generate individual variable declarations
    const scalarVarsBlock = config.scalarVars.join("\n");
    const enumVarsBlock = config.enumVars.length > 0 ? config.enumVars.join("\n") : "// (no enums)";
    const inputVarsBlock = config.inputVars.length > 0 ? config.inputVars.join("\n") : "// (no inputs)";
    const objectVarsBlock = config.objectVars.length > 0 ? config.objectVars.join("\n") : "// (no objects)";
    const unionVarsBlock = config.unionVars.length > 0 ? config.unionVars.join("\n") : "// (no unions)";

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
} as const;

const ${factoryVar} = createVarMethodFactory<typeof ${schemaVar}>();
const ${inputTypeMethodsVar} = ${config.inputTypeMethodsBlock};
const ${customDirectivesVar} = { ...createStandardDirectives(), ...${config.directiveMethodsBlock} };

${typeExports.join("\n")}`);

    // Build gql entry with options - inputTypeMethods is always required
    // Include FragmentBuilders type for codegen optimization
    if (adapterVar) {
      const typeParams = `<Schema_${name}, FragmentBuilders_${name}, typeof ${customDirectivesVar}, Adapter_${name}>`;
      gqlEntries.push(
        `  ${name}: createGqlElementComposer${typeParams}(${schemaVar}, { adapter: ${adapterVar}, inputTypeMethods: ${inputTypeMethodsVar}, directiveMethods: ${customDirectivesVar} })`,
      );
    } else {
      const typeParams = `<Schema_${name}, FragmentBuilders_${name}, typeof ${customDirectivesVar}>`;
      gqlEntries.push(
        `  ${name}: createGqlElementComposer${typeParams}(${schemaVar}, { inputTypeMethods: ${inputTypeMethodsVar}, directiveMethods: ${customDirectivesVar} })`,
      );
    }
  }

  // Generate prebuilt exports if requested
  const prebuiltExports: string[] = [];
  if ($$.exportForPrebuilt) {
    for (const name of Object.keys($$.schemas)) {
      const schemaVar = `${name}Schema`;
      const inputTypeMethodsVar = `inputTypeMethods_${name}`;
      const customDirectivesVar = `customDirectives_${name}`;
      const adapterVar = adapterAliases.get(name);

      prebuiltExports.push(`export { ${schemaVar} as __schema_${name} };`);
      prebuiltExports.push(`export { ${inputTypeMethodsVar} as __inputTypeMethods_${name} };`);
      prebuiltExports.push(`export { ${customDirectivesVar} as __directiveMethods_${name} };`);
      if (adapterVar) {
        prebuiltExports.push(`export { ${adapterVar} as __adapter_${name} };`);
      }
    }
  }
  const prebuiltExportsBlock =
    prebuiltExports.length > 0 ? `\n\n// Exports for prebuilt module\n${prebuiltExports.join("\n")}` : "";

  return `\
import {
  defineEnum,
  type ExtractMetadataAdapter,
  type FragmentBuilderFor,
  createDirectiveMethod,
  createGqlElementComposer,
  createStandardDirectives,
  createVarMethodFactory,
} from "@soda-gql/core";
${extraImports}
${schemaBlocks.join("\n")}

export const gql = {
${gqlEntries.join(",\n")}
};${prebuiltExportsBlock}
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

    // Collect type names
    const objectTypeNames = collectObjectTypeNames(schema);
    const enumTypeNames = collectEnumTypeNames(schema);
    const inputTypeNames = collectInputTypeNames(schema);
    const unionTypeNames = collectUnionTypeNames(schema);
    const customScalarNames = collectScalarNames(schema).filter((n) => !builtinScalarTypes.has(n));

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
        inputVars.push(renderInputVar(name, schema, record));
      }
    }

    // Objects
    for (const objectName of objectTypeNames) {
      const record = schema.objects.get(objectName);
      if (record) {
        objectVars.push(renderObjectVar(name, schema, record));
      }
    }

    // Unions
    for (const unionName of unionTypeNames) {
      const record = schema.unions.get(unionName);
      if (record) {
        unionVars.push(renderUnionVar(name, record));
      }
    }

    // Type name lists for assembly
    const allScalarNames = [...builtinScalarTypes.keys(), ...customScalarNames];

    const factoryVar = `createMethod_${name}`;
    const inputTypeMethodsBlock = renderInputTypeMethods(schema, factoryVar);
    const directiveMethodsBlock = renderDirectiveMethods(schema);
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
    ? { mode: "inject", perSchema: options.injection }
    : { mode: "inline" };

  const code = multiRuntimeTemplate({
    schemas: schemaConfigs,
    injection,
    exportForPrebuilt: options?.exportForPrebuilt,
  });

  return {
    code,
    stats: allStats,
  };
};
