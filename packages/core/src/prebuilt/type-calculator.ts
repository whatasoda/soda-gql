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
import type { TypeModifier } from "../types/type-foundation";

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
 * Get the TypeScript type string for a scalar type from the schema.
 */
export const getScalarType = (schema: AnyGraphqlSchema, scalarName: string): string => {
  const scalarDef = schema.scalar[scalarName];
  if (!scalarDef) {
    // Fallback for unknown scalars
    return "unknown";
  }

  // Extract the output type from the scalar definition
  // The $type.output contains the TypeScript type
  const outputType = scalarDef.$type?.output;

  if (typeof outputType === "string") {
    return "string";
  }
  if (typeof outputType === "number") {
    return "number";
  }
  if (typeof outputType === "boolean") {
    return "boolean";
  }

  // For complex types, we need to derive from the scalar name
  // Common scalars:
  switch (scalarName) {
    case "ID":
    case "String":
      return "string";
    case "Int":
    case "Float":
      return "number";
    case "Boolean":
      return "boolean";
    default:
      // Custom scalars - check if we have type info
      return "unknown";
  }
};

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
 * Calculate the TypeScript type string for a single field selection.
 */
export const calculateFieldType = (schema: AnyGraphqlSchema, selection: AnyFieldSelection): string => {
  const { type } = selection;

  // Handle object types (nested selection)
  if (type.kind === "object" && selection.object) {
    const nestedType = calculateFieldsType(schema, selection.object);
    return applyTypeModifier(nestedType, type.modifier);
  }

  // Handle union types
  if (type.kind === "union" && selection.union) {
    const unionType = calculateUnionType(schema, selection.union);
    return applyTypeModifier(unionType, type.modifier);
  }

  // Handle __typename special field
  if (type.kind === "typename") {
    // __typename returns a string literal type
    return applyTypeModifier(`"${type.name}"`, type.modifier);
  }

  // Handle scalar types
  if (type.kind === "scalar") {
    const scalarType = getScalarType(schema, type.name);
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
const calculateUnionType = (schema: AnyGraphqlSchema, union: AnyNestedUnion): string => {
  const memberTypes: string[] = [];

  for (const [_typeName, fields] of Object.entries(union)) {
    if (fields) {
      const memberType = calculateFieldsType(schema, fields);
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
 */
export const calculateFieldsType = (schema: AnyGraphqlSchema, fields: AnyFields | AnyNestedObject): string => {
  const entries = Object.entries(fields);

  if (entries.length === 0) {
    return "{}";
  }

  const fieldTypes = entries.map(([alias, selection]) => {
    const fieldType = calculateFieldType(schema, selection);
    // Use readonly for all fields to match InferFields behavior
    return `readonly ${alias}: ${fieldType}`;
  });

  return `{ ${fieldTypes.join("; ")} }`;
};

/**
 * Convert a GraphQL TypeNode to a TypeScript type string.
 *
 * Handles NonNullType, ListType, and NamedType recursively.
 */
export const graphqlTypeToTypeScript = (schema: AnyGraphqlSchema, typeNode: TypeNode): string => {
  switch (typeNode.kind) {
    case Kind.NON_NULL_TYPE:
      return graphqlTypeToTypeScript(schema, typeNode.type);
    case Kind.LIST_TYPE: {
      const inner = graphqlTypeToTypeScript(schema, typeNode.type);
      return `(${inner})[]`;
    }
    case Kind.NAMED_TYPE: {
      const name = typeNode.name.value;
      // Check if scalar
      if (schema.scalar[name]) {
        return getScalarType(schema, name);
      }
      // Check if enum
      if (schema.enum[name]) {
        return getEnumType(schema, name);
      }
      // Input object - use type name directly to avoid circular references
      return name;
    }
  }
};

/**
 * Generate a TypeScript type string for operation input variables.
 *
 * Extracts variable types from GraphQL VariableDefinitionNode AST.
 */
export const generateInputType = (
  schema: AnyGraphqlSchema,
  variableDefinitions: readonly VariableDefinitionNode[],
): string => {
  if (variableDefinitions.length === 0) {
    return "{}";
  }

  const fields = variableDefinitions.map((varDef) => {
    const name = varDef.variable.name.value;
    const isRequired = varDef.type.kind === Kind.NON_NULL_TYPE;
    const tsType = graphqlTypeToTypeScript(schema, varDef.type);

    // Apply nullability wrapper for optional fields
    const finalType = isRequired ? tsType : `(${tsType} | null | undefined)`;
    return `readonly ${name}${isRequired ? "" : "?"}: ${finalType}`;
  });

  return `{ ${fields.join("; ")} }`;
};
