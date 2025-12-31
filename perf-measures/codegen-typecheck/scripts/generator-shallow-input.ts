/**
 * Generator for Approach D: Shallow Input Type Inference
 *
 * This generator produces code with reduced input type inference depth.
 * Instead of the default depth of 3, it uses depth 1 or 2 to reduce
 * the number of recursive type evaluations for complex input types
 * like `*_bool_exp`.
 *
 * This trades some type precision for better performance.
 */

import {
  type ConstDirectiveNode,
  type ConstValueNode,
  type DocumentNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  Kind,
  type NamedTypeNode,
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
  readonly values: string[];
  directives: ConstDirectiveNode[];
};

type UnionRecord = {
  readonly name: string;
  readonly members: string[];
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
        const name = definition.name.value;
        let record = objects.get(name);
        if (!record) {
          record = { name, fields: new Map(), directives: [] };
          objects.set(name, record);
        }
        for (const field of definition.fields ?? []) {
          record.fields.set(field.name.value, field);
        }
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const name = definition.name.value;
        let record = inputs.get(name);
        if (!record) {
          record = { name, fields: new Map(), directives: [] };
          inputs.set(name, record);
        }
        for (const field of definition.fields ?? []) {
          record.fields.set(field.name.value, field);
        }
        break;
      }
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION: {
        const name = definition.name.value;
        let record = enums.get(name);
        if (!record) {
          record = { name, values: [], directives: [] };
          enums.set(name, record);
        }
        for (const value of definition.values ?? []) {
          if (!record.values.includes(value.name.value)) {
            record.values.push(value.name.value);
          }
        }
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION: {
        const name = definition.name.value;
        let record = unions.get(name);
        if (!record) {
          record = { name, members: [], directives: [] };
          unions.set(name, record);
        }
        for (const member of definition.types ?? []) {
          if (!record.members.includes(member.name.value)) {
            record.members.push(member.name.value);
          }
        }
        break;
      }
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION: {
        const name = definition.name.value;
        if (!scalars.has(name)) {
          scalars.set(name, { name, directives: [] });
        }
        break;
      }
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
        for (const op of definition.operationTypes ?? []) {
          const typeName = op.type.name.value;
          switch (op.operation) {
            case "query":
              operationTypes.query = typeName;
              break;
            case "mutation":
              operationTypes.mutation = typeName;
              break;
            case "subscription":
              operationTypes.subscription = typeName;
              break;
          }
        }
        break;
    }
  }

  // Default operation types
  if (!operationTypes.query && objects.has("Query")) {
    operationTypes.query = "Query";
  }
  if (!operationTypes.mutation && objects.has("Mutation")) {
    operationTypes.mutation = "Mutation";
  }
  if (!operationTypes.subscription && objects.has("Subscription")) {
    operationTypes.subscription = "Subscription";
  }

  return { objects, inputs, enums, unions, scalars, operationTypes };
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

const renderDefaultValue = (value: ConstValueNode | null | undefined): string =>
  value ? `() => (${renderConstValue(value)})` : "null";

const renderPropertyLines = ({ entries, indentSize }: { entries: string[]; indentSize: number }) => {
  if (entries.length === 0) {
    return "{}";
  }
  const indent = " ".repeat(indentSize);
  const lastIndent = " ".repeat(indentSize - 2);
  return ["{", `${indent}${entries.join(`,\n${indent}`)},`, `${lastIndent}}`].join(`\n`);
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
    kind = "scalar";
  }

  return `{ kind: "${kind}", name: "${name}", modifier: "${modifier}", arguments: ${argumentMap} }`;
};

// Identify input types that should have reduced depth (complex/recursive types)
const identifyComplexInputTypes = (schema: SchemaIndex): Set<string> => {
  const complexTypes = new Set<string>();

  for (const [name, record] of schema.inputs) {
    // Types ending in _bool_exp, _order_by, _insert_input, _set_input are typically complex/recursive
    if (
      name.endsWith("_bool_exp") ||
      name.endsWith("_order_by") ||
      name.endsWith("_insert_input") ||
      name.endsWith("_set_input") ||
      name.endsWith("_on_conflict") ||
      name.endsWith("_updates")
    ) {
      complexTypes.add(name);
    }

    // Also check for self-referential types
    for (const [_, field] of record.fields) {
      const { name: fieldTypeName } = parseTypeReference(field.type);
      if (fieldTypeName === name) {
        complexTypes.add(name);
        break;
      }
    }
  }

  return complexTypes;
};

export type ShallowInputOptions = {
  defaultDepth?: number;  // Default depth for all input types (default: 2)
  complexTypeDepth?: number;  // Depth for complex types like bool_exp (default: 1)
};

export const generateMultiSchemaModuleShallowInput = (
  schemas: Map<string, DocumentNode>,
  options: ShallowInputOptions = {},
): { code: string } => {
  const defaultDepth = options.defaultDepth ?? 2;
  const complexTypeDepth = options.complexTypeDepth ?? 1;

  const schemaBlocks: string[] = [];
  const gqlEntries: string[] = [];

  for (const [name, document] of schemas.entries()) {
    const schema = createSchemaIndex(document);
    const complexTypes = identifyComplexInputTypes(schema);

    // Generate depth overrides for complex types
    const depthOverrides: Record<string, number> = {};
    for (const typeName of complexTypes) {
      depthOverrides[typeName] = complexTypeDepth;
    }

    // Generate scalar definitions
    const builtinScalarDefinitions = Array.from(builtinScalarTypes.keys()).map((scalarName) => {
      const typeInfo = builtinScalarTypes.get(scalarName)!;
      return `${scalarName}: { name: "${scalarName}", $type: {} as { input: ${typeInfo.input}; output: ${typeInfo.output}; inputProfile: { kind: "scalar"; name: "${scalarName}"; value: ${typeInfo.input} }; outputProfile: { kind: "scalar"; name: "${scalarName}"; value: ${typeInfo.output} } } }`;
    });

    const customScalarDefinitions = Array.from(schema.scalars.keys())
      .filter((n) => !builtinScalarTypes.has(n))
      .sort()
      .map((scalarName) => {
        return `${scalarName}: { name: "${scalarName}", $type: {} as { input: string; output: string; inputProfile: { kind: "scalar"; name: "${scalarName}"; value: string }; outputProfile: { kind: "scalar"; name: "${scalarName}"; value: string } } }`;
      });

    const allScalarDefinitions = builtinScalarDefinitions.concat(customScalarDefinitions);
    const scalarBlock = renderPropertyLines({ entries: allScalarDefinitions, indentSize: 4 });

    // Generate enum definitions
    const enumDefinitions = Array.from(schema.enums.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([enumName, record]) => {
        const values = record.values.sort();
        const valuesObj = values.length === 0 ? "{}" : `{ ${values.map((v) => `${v}: true`).join(", ")} }`;
        const valueUnion = values.length === 0 ? "never" : values.map((v) => `"${v}"`).join(" | ");
        return `${enumName}: { name: "${enumName}", values: ${valuesObj}, $type: {} as { name: "${enumName}"; inputProfile: { kind: "enum"; name: "${enumName}"; value: ${valueUnion} }; outputProfile: { kind: "enum"; name: "${enumName}"; value: ${valueUnion} } } }`;
      });
    const enumBlock = renderPropertyLines({ entries: enumDefinitions, indentSize: 4 });

    // Generate input definitions
    const inputDefinitions = Array.from(schema.inputs.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inputName, record]) => {
        const fields = Array.from(record.fields.values())
          .sort((a, b) => a.name.value.localeCompare(b.name.value))
          .map((field) => `${field.name.value}: ${renderInputRef(schema, field)}`);
        const fieldsBlock = renderPropertyLines({ entries: fields, indentSize: 6 });
        return `${inputName}: { name: "${inputName}", fields: ${fieldsBlock} }`;
      });
    const inputBlock = renderPropertyLines({ entries: inputDefinitions, indentSize: 4 });

    // Generate object definitions
    const objectTypeNames = Array.from(schema.objects.keys())
      .filter((n) => !n.startsWith("__"))
      .sort();

    const objectDefinitions = objectTypeNames.map((objName) => {
      const record = schema.objects.get(objName)!;
      const fields = Array.from(record.fields.values())
        .sort((a, b) => a.name.value.localeCompare(b.name.value))
        .map((field) => `${field.name.value}: ${renderOutputRef(schema, field.type, field.arguments)}`);
      const fieldsBlock = renderPropertyLines({ entries: fields, indentSize: 6 });
      return `${objName}: { name: "${objName}", fields: ${fieldsBlock} }`;
    });
    const objectBlock = renderPropertyLines({ entries: objectDefinitions, indentSize: 4 });

    // Generate union definitions
    const unionDefinitions = Array.from(schema.unions.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([unionName, record]) => {
        const members = record.members.sort();
        const typesObj = members.length === 0 ? "{}" : `{ ${members.map((m) => `${m}: true`).join(", ")} }`;
        return `${unionName}: { name: "${unionName}", types: ${typesObj} }`;
      });
    const unionBlock = renderPropertyLines({ entries: unionDefinitions, indentSize: 4 });

    // Generate input type methods
    const allInputTypeNames = [
      ...Array.from(builtinScalarTypes.keys()),
      ...Array.from(schema.scalars.keys()).filter((n) => !builtinScalarTypes.has(n)),
      ...Array.from(schema.enums.keys()),
      ...Array.from(schema.inputs.keys()),
    ].sort();

    const inputTypeMethodEntries = allInputTypeNames.map((typeName) => {
      let kind: "scalar" | "enum" | "input";
      if (builtinScalarTypes.has(typeName) || schema.scalars.has(typeName)) {
        kind = "scalar";
      } else if (schema.enums.has(typeName)) {
        kind = "enum";
      } else {
        kind = "input";
      }
      return `${typeName}: createMethod_${name}("${kind}", "${typeName}")`;
    });
    const inputTypeMethodsBlock = renderPropertyLines({ entries: inputTypeMethodEntries, indentSize: 2 });

    // Generate fragment builders type
    const fragmentBuilderTypeEntries = objectTypeNames.map((objName) => {
      return `  readonly ${objName}: FragmentBuilderFor<Schema_${name}, "${objName}">`;
    });
    const fragmentBuildersTypeBlock =
      fragmentBuilderTypeEntries.length === 0
        ? `type FragmentBuilders_${name} = Record<string, never>;`
        : `type FragmentBuilders_${name} = {\n${fragmentBuilderTypeEntries.join(";\n")};\n};`;

    const queryType = schema.operationTypes.query ?? "Query";
    const mutationType = schema.operationTypes.mutation ?? "Mutation";
    const subscriptionType = schema.operationTypes.subscription ?? "Subscription";

    const schemaVar = `${name}Schema`;

    // Generate depth override block
    const depthOverrideEntries = Object.entries(depthOverrides)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([typeName, depth]) => `"${typeName}": ${depth}`);
    const depthOverridesBlock = depthOverrideEntries.length > 0
      ? `\n  __inputDepthOverrides: { ${depthOverrideEntries.join(", ")} },`
      : "";

    schemaBlocks.push(`
const ${schemaVar} = {
  label: "${name}",
  operations: { query: "${queryType}", mutation: "${mutationType}", subscription: "${subscriptionType}" },
  scalar: ${scalarBlock},
  enum: ${enumBlock},
  input: ${inputBlock},
  object: ${objectBlock},
  union: ${unionBlock},
  __defaultInputDepth: ${defaultDepth},${depthOverridesBlock}
} as const;

const createMethod_${name} = createVarMethodFactory<typeof ${schemaVar}>();
const inputTypeMethods_${name} = ${inputTypeMethodsBlock};

export type Schema_${name} = typeof ${schemaVar} & { _?: never };
${fragmentBuildersTypeBlock}`);

    const typeParams = `<Schema_${name}, FragmentBuilders_${name}>`;
    gqlEntries.push(
      `  ${name}: createGqlElementComposer${typeParams}(${schemaVar}, { inputTypeMethods: inputTypeMethods_${name} })`,
    );
  }

  const code = `\
import {
  type FragmentBuilderFor,
  createGqlElementComposer,
  createVarMethodFactory,
} from "@soda-gql/core";
${schemaBlocks.join("\n")}

export const gql = {
${gqlEntries.join(",\n")}
};
`;

  return { code };
};
