/**
 * Shared utility functions for CLI.
 * @module
 */

import {
  type GraphQLNamedType,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";
import type { ConfigContext } from "./config-registry";
import { collectRawDiagnostics } from "./diagnostics-collector";
import type { DocumentState } from "./types";

/** Extract variable declaration from template content (e.g., "($id: ID!)"). */
export const extractVariablesFromContent = (content: string): string | undefined => {
  const match = content.match(/^\s*\(([^)]+)\)/);
  return match ? `(${match[1]})` : undefined;
};

/** Compute 1-based line number from a byte offset in source. */
export const computeLineFromOffset = (source: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
};

/** Collect diagnostics and map to JSON-serializable format. */
export type DiagnosticResult = { message: string; line: number; column: number; severity: string };

export const collectDiagnostics = (state: DocumentState, ctx: ConfigContext): DiagnosticResult[] => {
  const diagnostics = collectRawDiagnostics(state, ctx);
  return [...diagnostics].map((d) => ({
    message: d.message,
    line: d.range.start.line + 1,
    column: d.range.start.character + 1,
    severity: diagnosticSeverityToString(d.severity),
  }));
};

export const diagnosticSeverityToString = (severity: number | undefined): string => {
  switch (severity) {
    case 1:
      return "Error";
    case 2:
      return "Warning";
    case 3:
      return "Information";
    case 4:
      return "Hint";
    default:
      return "Error";
  }
};

/** Introspect a single GraphQL type (depth-1). */
export const introspectType = (schema: GraphQLSchema, typeName: string) => {
  const type = schema.getType(typeName);
  if (!type) return undefined;

  if (isObjectType(type) || isInterfaceType(type)) {
    const fields = Object.values(type.getFields()).map((f) => ({
      name: f.name,
      type: f.type.toString(),
      args: f.args.map((a) => ({ name: a.name, type: a.type.toString() })),
    }));
    return { name: type.name, kind: isObjectType(type) ? "OBJECT" : "INTERFACE", fields };
  }
  if (isUnionType(type)) {
    return { name: type.name, kind: "UNION", members: type.getTypes().map((t) => ({ name: t.name })) };
  }
  if (isEnumType(type)) {
    return { name: type.name, kind: "ENUM", values: type.getValues().map((v) => ({ name: v.name })) };
  }
  if (isInputObjectType(type)) {
    const fields = Object.values(type.getFields()).map((f) => ({
      name: f.name,
      type: f.type.toString(),
    }));
    return { name: type.name, kind: "INPUT_OBJECT", fields };
  }
  if (isScalarType(type)) {
    return { name: type.name, kind: "SCALAR" };
  }
  return undefined;
};

/** List all user-defined types in a schema. */
export const listTypes = (schema: GraphQLSchema) => {
  const typeMap = schema.getTypeMap();
  const types = Object.values(typeMap)
    .filter((t) => !t.name.startsWith("__"))
    .map((t) => ({ name: t.name, kind: getTypeKind(t) }));
  return { types };
};

const getTypeKind = (type: GraphQLNamedType): string => {
  if (isObjectType(type)) return "OBJECT";
  if (isInterfaceType(type)) return "INTERFACE";
  if (isUnionType(type)) return "UNION";
  if (isEnumType(type)) return "ENUM";
  if (isInputObjectType(type)) return "INPUT_OBJECT";
  if (isScalarType(type)) return "SCALAR";
  return "UNKNOWN";
};
