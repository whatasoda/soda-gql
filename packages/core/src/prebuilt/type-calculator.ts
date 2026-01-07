/**
 * Type calculator for generating TypeScript type strings from field selections.
 *
 * This is a runtime reimplementation of the InferFields type-level computation,
 * used for generating prebuilt types that can be bundled without losing type information.
 *
 * @module
 */

import { Kind, type TypeNode, type VariableDefinitionNode } from "graphql";
import type { AnyFieldSelection, AnyFields, AnyNestedObject, AnyNestedUnion } from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
import type { InputDepthOverrides, InputTypeSpecifier, InputTypeSpecifiers, TypeModifier } from "../types/type-foundation";

/**
 * Formatters for customizing type name output.
 *
 * Used by type generation functions to format scalar and input object type names
 * with custom prefixes or patterns (e.g., schema-specific prefixes).
 */
export type TypeFormatters = {
  /**
   * Format a scalar input type name.
   * Default: `ScalarInput<"Name">`
   */
  readonly scalarInput?: (name: string) => string;
  /**
   * Format a scalar output type name.
   * Default: `ScalarOutput<"Name">`
   */
  readonly scalarOutput?: (name: string) => string;
  /**
   * Format an input object type name.
   * Default: returns the name unchanged
   */
  readonly inputObject?: (name: string) => string;
};

/**
 * Apply a type modifier to a base type string.
 *
 * Modifier format:
 * - "!" = required (T)
 * - "?" = optional (T | null | undefined)
 * - "![]!" = required array of required items (T[])
 * - "![]?" = optional array of required items (T[] | null | undefined)
 * - "?[]!" = required array of optional items ((T | null | undefined)[])
 * - "?[]?" = optional array of optional items ((T | null | undefined)[] | null | undefined)
 * - Deeper nesting follows the same pattern
 */
export const applyTypeModifier = (baseType: string, modifier: TypeModifier): string => {
  // Parse modifier from inside out
  // Modifier format: innerNullability[]outerNullability[]...
  // e.g., "?[]!" means: inner is nullable, wrapped in non-null array

  if (modifier === "!") {
    return baseType;
  }
  if (modifier === "?") {
    return `(${baseType} | null | undefined)`;
  }

  // For array types, parse the modifier pattern
  // Pattern: (innerNullability)([]outerNullability)*
  const parts = modifier.split("[]");
  if (parts.length < 2) {
    // Fallback for unexpected modifier format
    return baseType;
  }

  // Build type from inside out
  let result = baseType;

  // First part is the innermost nullability
  const innerNullability = parts[0];
  if (innerNullability === "?") {
    result = `(${result} | null | undefined)`;
  }

  // Remaining parts are array wrappings with their nullability
  for (let i = 1; i < parts.length; i++) {
    const arrayNullability = parts[i];
    result = `(${result})[]`;
    if (arrayNullability === "?") {
      result = `(${result} | null | undefined)`;
    }
  }

  return result;
};

/**
 * Get the TypeScript type string for a scalar output type from the schema.
 *
 * Returns a `ScalarOutput<"Name">` reference for all scalars in the schema.
 * The actual type is resolved at compile time from the inject file's scalar definitions.
 * This allows users to customize even built-in scalars (ID, String, etc.).
 */
export const getScalarOutputType = (schema: AnyGraphqlSchema, scalarName: string): string => {
  // ALL scalars use ScalarOutput reference - inject file is the source of truth
  if (schema.scalar[scalarName]) {
    return `ScalarOutput<"${scalarName}">`;
  }
  // Unknown scalar not in schema
  return "unknown";
};

/**
 * Get the TypeScript type string for a scalar input type from the schema.
 *
 * Returns a `ScalarInput<"Name">` reference for all scalars in the schema.
 * Used for input/variable types in operations.
 */
export const getScalarInputType = (schema: AnyGraphqlSchema, scalarName: string): string => {
  if (schema.scalar[scalarName]) {
    return `ScalarInput<"${scalarName}">`;
  }
  return "unknown";
};

/**
 * @deprecated Use getScalarOutputType instead
 */
export const getScalarType = getScalarOutputType;

/**
 * Get the TypeScript type string for an enum type from the schema.
 */
export const getEnumType = (schema: AnyGraphqlSchema, enumName: string): string => {
  const enumDef = schema.enum[enumName];
  if (!enumDef) {
    return "string";
  }

  // Get enum values and create a union type
  const values = Object.keys(enumDef.values);
  if (values.length === 0) {
    return "never";
  }

  return values.map((v) => `"${v}"`).join(" | ");
};

/**
 * Default depth limit for input object type generation.
 */
const DEFAULT_INPUT_DEPTH = 3;

/**
 * Options for generating input object types.
 */
export type GenerateInputObjectTypeOptions = {
  /**
   * Default depth limit for recursive types.
   * @default 3
   */
  readonly defaultDepth?: number;
  /**
   * Per-type depth overrides.
   */
  readonly depthOverrides?: InputDepthOverrides;
  /**
   * Custom formatters for type names.
   */
  readonly formatters?: TypeFormatters;
};

/**
 * Generate a TypeScript type string for an input object type.
 *
 * Recursively expands fields using ScalarInput for scalars.
 * Returns `unknown` if depth is exhausted or circular reference is detected.
 *
 * @param schema - The GraphQL schema
 * @param inputName - The input object type name
 * @param options - Generation options including depth limits
 * @param seen - Set of already visited input names (for circular reference detection)
 * @param currentDepth - Current recursion depth
 */
export const generateInputObjectType = (
  schema: AnyGraphqlSchema,
  inputName: string,
  options: GenerateInputObjectTypeOptions = {},
  seen: Set<string> = new Set(),
  currentDepth?: number,
): string => {
  const inputDef = schema.input[inputName];
  if (!inputDef) {
    return "unknown";
  }

  // Get depth limit for this type
  const depthOverrides = options.depthOverrides ?? {};
  const defaultDepth = options.defaultDepth ?? DEFAULT_INPUT_DEPTH;
  const maxDepth = depthOverrides[inputName] ?? defaultDepth;

  // Initialize or use current depth
  const depth = currentDepth ?? maxDepth;

  // Check depth exhaustion
  if (depth <= 0) {
    return "unknown";
  }

  // Check circular reference
  if (seen.has(inputName)) {
    return "unknown";
  }

  // Add to seen set for this branch
  const newSeen = new Set(seen);
  newSeen.add(inputName);

  const fields = inputDef.fields;
  const fieldEntries = Object.entries(fields);

  if (fieldEntries.length === 0) {
    return "{}";
  }

  const fieldTypes = fieldEntries.map(([fieldName, specifier]) => {
    const fieldType = generateInputFieldType(schema, specifier, options, newSeen, depth - 1);
    const isOptional = specifier.modifier === "?" || specifier.modifier.endsWith("?");
    const hasDefault = specifier.defaultValue != null;

    // Fields with defaults or nullable fields are optional
    if (hasDefault || isOptional) {
      return `readonly ${fieldName}?: ${fieldType}`;
    }
    return `readonly ${fieldName}: ${fieldType}`;
  });

  return `{ ${fieldTypes.join("; ")} }`;
};

/**
 * Generate a TypeScript type string for an input field based on its specifier.
 */
const generateInputFieldType = (
  schema: AnyGraphqlSchema,
  specifier: { readonly kind: string; readonly name: string; readonly modifier: TypeModifier },
  options: GenerateInputObjectTypeOptions,
  seen: Set<string>,
  depth: number,
): string => {
  let baseType: string;
  const { formatters } = options;

  switch (specifier.kind) {
    case "scalar":
      baseType = formatters?.scalarInput?.(specifier.name) ?? getScalarInputType(schema, specifier.name);
      break;
    case "enum":
      baseType = getEnumType(schema, specifier.name);
      break;
    case "input":
      baseType = formatters?.inputObject?.(specifier.name) ?? generateInputObjectType(schema, specifier.name, options, seen, depth);
      break;
    default:
      baseType = "unknown";
  }

  return applyTypeModifier(baseType, specifier.modifier);
};

/**
 * Calculate the TypeScript type string for a single field selection.
 *
 * @param schema - The GraphQL schema
 * @param selection - The field selection to calculate type for
 * @param formatters - Optional formatters for customizing type names
 */
export const calculateFieldType = (
  schema: AnyGraphqlSchema,
  selection: AnyFieldSelection,
  formatters?: TypeFormatters,
): string => {
  const { type } = selection;

  // Handle object types (nested selection)
  if (type.kind === "object" && selection.object) {
    const nestedType = calculateFieldsType(schema, selection.object, formatters);
    return applyTypeModifier(nestedType, type.modifier);
  }

  // Handle union types
  if (type.kind === "union" && selection.union) {
    const unionType = calculateUnionType(schema, selection.union, formatters);
    return applyTypeModifier(unionType, type.modifier);
  }

  // Handle __typename special field
  if (type.kind === "typename") {
    // __typename returns a string literal type
    return applyTypeModifier(`"${type.name}"`, type.modifier);
  }

  // Handle scalar types
  if (type.kind === "scalar") {
    const scalarType = formatters?.scalarOutput?.(type.name) ?? getScalarOutputType(schema, type.name);
    return applyTypeModifier(scalarType, type.modifier);
  }

  // Handle enum types
  if (type.kind === "enum") {
    const enumType = getEnumType(schema, type.name);
    return applyTypeModifier(enumType, type.modifier);
  }

  // Fallback
  return "unknown";
};

/**
 * Calculate the TypeScript type string for a union type selection.
 */
const calculateUnionType = (
  schema: AnyGraphqlSchema,
  union: AnyNestedUnion,
  formatters?: TypeFormatters,
): string => {
  const memberTypes: string[] = [];

  for (const [_typeName, fields] of Object.entries(union)) {
    if (fields) {
      const memberType = calculateFieldsType(schema, fields, formatters);
      memberTypes.push(memberType);
    }
  }

  if (memberTypes.length === 0) {
    return "never";
  }

  return memberTypes.join(" | ");
};

/**
 * Calculate the TypeScript type string for a set of field selections.
 * This is the main entry point for type calculation.
 *
 * @param schema - The GraphQL schema
 * @param fields - The field selections to calculate types for
 * @param formatters - Optional formatters for customizing type names
 */
export const calculateFieldsType = (
  schema: AnyGraphqlSchema,
  fields: AnyFields | AnyNestedObject,
  formatters?: TypeFormatters,
): string => {
  const entries = Object.entries(fields);

  if (entries.length === 0) {
    return "{}";
  }

  const fieldTypes = entries.map(([alias, selection]) => {
    const fieldType = calculateFieldType(schema, selection, formatters);
    // Use readonly for all fields to match InferFields behavior
    return `readonly ${alias}: ${fieldType}`;
  });

  return `{ ${fieldTypes.join("; ")} }`;
};

/**
 * Convert a GraphQL TypeNode to a TypeScript type string for input types.
 *
 * Handles NonNullType, ListType, and NamedType recursively.
 * Uses ScalarInput for scalar types since this is used for input/variable types.
 *
 * @param schema - The GraphQL schema
 * @param typeNode - The GraphQL type node to convert
 * @param formatters - Optional formatters for customizing type names
 */
export const graphqlTypeToTypeScript = (
  schema: AnyGraphqlSchema,
  typeNode: TypeNode,
  formatters?: TypeFormatters,
): string => {
  switch (typeNode.kind) {
    case Kind.NON_NULL_TYPE:
      return graphqlTypeToTypeScript(schema, typeNode.type, formatters);
    case Kind.LIST_TYPE: {
      const inner = graphqlTypeToTypeScript(schema, typeNode.type, formatters);
      return `(${inner})[]`;
    }
    case Kind.NAMED_TYPE: {
      const name = typeNode.name.value;
      // Check if scalar - use ScalarInput for input types
      if (schema.scalar[name]) {
        return formatters?.scalarInput?.(name) ?? getScalarInputType(schema, name);
      }
      // Check if enum
      if (schema.enum[name]) {
        return getEnumType(schema, name);
      }
      // Input object - use formatter or return name directly
      return formatters?.inputObject?.(name) ?? name;
    }
  }
};

/**
 * Generate a TypeScript type string for operation input variables.
 *
 * Extracts variable types from GraphQL VariableDefinitionNode AST.
 *
 * @param schema - The GraphQL schema
 * @param variableDefinitions - Variable definition nodes from the operation
 * @param formatters - Optional formatters for customizing type names
 */
export const generateInputType = (
  schema: AnyGraphqlSchema,
  variableDefinitions: readonly VariableDefinitionNode[],
  formatters?: TypeFormatters,
): string => {
  if (variableDefinitions.length === 0) {
    return "{}";
  }

  const fields = variableDefinitions.map((varDef) => {
    const name = varDef.variable.name.value;
    const isRequired = varDef.type.kind === Kind.NON_NULL_TYPE;
    const tsType = graphqlTypeToTypeScript(schema, varDef.type, formatters);

    // Apply nullability wrapper for optional fields
    const finalType = isRequired ? tsType : `(${tsType} | null | undefined)`;
    return `readonly ${name}${isRequired ? "" : "?"}: ${finalType}`;
  });

  return `{ ${fields.join("; ")} }`;
};

/**
 * Generate TypeScript type for a single input field from its specifier.
 * Used by generateInputTypeFromSpecifiers.
 */
const generateInputFieldTypeFromSpecifier = (
  schema: AnyGraphqlSchema,
  specifier: InputTypeSpecifier,
  options: GenerateInputObjectTypeOptions,
): string => {
  let baseType: string;
  const { formatters } = options;

  switch (specifier.kind) {
    case "scalar":
      baseType = formatters?.scalarInput?.(specifier.name) ?? getScalarInputType(schema, specifier.name);
      break;
    case "enum":
      baseType = getEnumType(schema, specifier.name);
      break;
    case "input":
      baseType = formatters?.inputObject?.(specifier.name) ?? generateInputObjectType(schema, specifier.name, options);
      break;
    default:
      baseType = "unknown";
  }

  return applyTypeModifier(baseType, specifier.modifier);
};

/**
 * Generate a TypeScript type string for input variables from InputTypeSpecifiers.
 *
 * Unlike generateInputType which works with GraphQL AST VariableDefinitionNode[],
 * this function works with soda-gql's internal InputTypeSpecifiers format.
 * Used for generating Fragment input types in prebuilt mode.
 *
 * @param schema - The GraphQL schema
 * @param specifiers - Input type specifiers (variable definitions)
 * @param options - Generation options including depth limits
 */
export const generateInputTypeFromSpecifiers = (
  schema: AnyGraphqlSchema,
  specifiers: InputTypeSpecifiers,
  options: GenerateInputObjectTypeOptions = {},
): string => {
  const entries = Object.entries(specifiers);

  if (entries.length === 0) {
    return "void";
  }

  const fields = entries.map(([name, specifier]) => {
    // Check if the outermost type is required
    // "!" = required, "?" = optional
    // "![]!" = required (outer), "![]?" = optional (outer)
    // For arrays, check if the last character is "!" (required outer) or "?" (optional outer)
    const isOuterRequired = specifier.modifier.endsWith("!");
    const hasDefault = specifier.defaultValue != null;
    const baseType = generateInputFieldTypeFromSpecifier(schema, specifier, options);

    // Field is optional if outer type is nullable or has default value
    const isOptional = !isOuterRequired || hasDefault;

    return `readonly ${name}${isOptional ? "?" : ""}: ${baseType}`;
  });

  return `{ ${fields.join("; ")} }`;
};
