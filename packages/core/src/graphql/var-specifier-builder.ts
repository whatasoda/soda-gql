/**
 * Converts VariableDefinitionNode from graphql-js AST into VarSpecifier objects
 * compatible with the composer's GenericVarSpecifier type.
 *
 * Uses throw (not Result) because it will be called from the composer layer.
 * @module
 */

import { Kind, type ValueNode, type VariableDefinitionNode } from "graphql";
import { parseTypeNode } from "./parser";
import type { SchemaIndex } from "./schema-index";

/**
 * Runtime VarSpecifier shape produced by this builder.
 * Compatible with GenericVarSpecifier from var-builder.ts.
 */
export type BuiltVarSpecifier = {
  readonly kind: "scalar" | "enum" | "input";
  readonly name: string;
  readonly modifier: string;
  readonly defaultValue: null | { readonly default: unknown };
  readonly directives: Record<string, never>;
};

const builtinScalarTypes = new Set(["ID", "String", "Int", "Float", "Boolean"]);

const resolveTypeKind = (schema: SchemaIndex, typeName: string): "scalar" | "enum" | "input" => {
  if (builtinScalarTypes.has(typeName) || schema.scalars.has(typeName)) return "scalar";
  if (schema.enums.has(typeName)) return "enum";
  if (schema.inputs.has(typeName)) return "input";
  throw new Error(`Cannot resolve type kind for "${typeName}": not found in schema as scalar, enum, or input`);
};

/**
 * Extract a constant value from a ValueNode (for default values).
 * Similar to graphql-js valueFromAST but without type coercion.
 */
const extractConstValue = (node: ValueNode): unknown => {
  switch (node.kind) {
    case Kind.INT:
      return Number.parseInt(node.value, 10);
    case Kind.FLOAT:
      return Number.parseFloat(node.value);
    case Kind.STRING:
      return node.value;
    case Kind.BOOLEAN:
      return node.value;
    case Kind.NULL:
      return null;
    case Kind.ENUM:
      return node.value;
    case Kind.LIST:
      return node.values.map(extractConstValue);
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {};
      for (const field of node.fields) {
        obj[field.name.value] = extractConstValue(field.value);
      }
      return obj;
    }
    case Kind.VARIABLE:
      throw new Error("Variable references are not allowed in default values");
    default:
      throw new Error(`Unexpected value kind: ${(node as { kind: string }).kind}`);
  }
};

const extractDefaultValue = (node: VariableDefinitionNode): null | { readonly default: unknown } => {
  if (!node.defaultValue) return null;
  return { default: extractConstValue(node.defaultValue) };
};

/**
 * Convert a VariableDefinitionNode to a VarSpecifier.
 * Resolves `kind` (scalar/enum/input) from the schema index.
 *
 * @throws Error if type name cannot be resolved in schema
 */
export const buildVarSpecifier = (node: VariableDefinitionNode, schema: SchemaIndex): BuiltVarSpecifier => {
  const { typeName, modifier } = parseTypeNode(node.type);
  const kind = resolveTypeKind(schema, typeName);
  const defaultValue = extractDefaultValue(node);

  return { kind, name: typeName, modifier, defaultValue, directives: {} as Record<string, never> };
};

/**
 * Convert all variable definitions from a list of VariableDefinitionNodes
 * into a record keyed by variable name.
 *
 * @throws Error if any type name cannot be resolved in schema
 */
export const buildVarSpecifiers = (
  nodes: readonly VariableDefinitionNode[],
  schema: SchemaIndex,
): Record<string, BuiltVarSpecifier> => {
  const result: Record<string, BuiltVarSpecifier> = {};
  for (const node of nodes) {
    result[node.variable.name.value] = buildVarSpecifier(node, schema);
  }
  return result;
};
