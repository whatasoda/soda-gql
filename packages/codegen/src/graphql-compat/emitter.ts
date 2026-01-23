/**
 * Emitter for generating TypeScript compat code from enriched operations.
 * @module
 */

import type { DocumentNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import { createSchemaIndex } from "../generator";
import {
  type EnrichedFragment,
  type EnrichedOperation,
  getArgumentType,
  getFieldReturnType,
  getInputFieldType,
} from "./transformer";
import type { GraphqlCompatError, ParsedArgument, ParsedInlineFragment, ParsedSelection, ParsedValue } from "./types";

/**
 * Schema index for type lookups.
 */
type SchemaIndex = ReturnType<typeof createSchemaIndex>;

/**
 * Options for code emission.
 */
export type EmitOptions = {
  /** Schema name to use in gql.schemaName() call */
  readonly schemaName: string;
  /** Import path for graphql-system module */
  readonly graphqlSystemPath: string;
  /** Schema document for type lookups (required for inline fragment support) */
  readonly schemaDocument?: DocumentNode;
};

/**
 * Map operation kind to root type name.
 */
const getRootTypeName = (kind: "query" | "mutation" | "subscription"): string => {
  switch (kind) {
    case "query":
      return "Query";
    case "mutation":
      return "Mutation";
    case "subscription":
      return "Subscription";
  }
};

/**
 * Emit TypeScript code for an operation.
 */
export const emitOperation = (operation: EnrichedOperation, options: EmitOptions): Result<string, GraphqlCompatError> => {
  const lines: string[] = [];
  const schema = options.schemaDocument ? createSchemaIndex(options.schemaDocument) : null;

  // Note: imports (gql and fragment) are handled by the caller

  // Generate export
  const exportName = `${operation.name}Compat`;
  const operationType = operation.kind;

  lines.push(`export const ${exportName} = gql.${options.schemaName}(({ ${operationType}, $var }) =>`);
  lines.push(`  ${operationType}.compat({`);
  lines.push(`    name: ${JSON.stringify(operation.name)},`);

  // Variables
  if (operation.variables.length > 0) {
    lines.push(`    variables: { ${emitVariables(operation.variables)} },`);
  }

  // Fields - pass root type name for list coercion
  const rootTypeName = getRootTypeName(operation.kind);
  lines.push(`    fields: ({ f, $ }) => ({`);
  const fieldLinesResult = emitSelections(operation.selections, 3, operation.variables, schema, rootTypeName);
  if (fieldLinesResult.isErr()) {
    return err(fieldLinesResult.error);
  }
  lines.push(fieldLinesResult.value);
  lines.push(`    }),`);

  lines.push(`  }),`);
  lines.push(`);`);

  return ok(lines.join("\n"));
};

/**
 * Emit TypeScript code for a fragment.
 */
export const emitFragment = (fragment: EnrichedFragment, options: EmitOptions): Result<string, GraphqlCompatError> => {
  const lines: string[] = [];
  const schema = options.schemaDocument ? createSchemaIndex(options.schemaDocument) : null;
  const hasVariables = fragment.variables.length > 0;

  // Note: imports (gql and fragment) are handled by the caller

  // Generate export
  const exportName = `${fragment.name}Fragment`;

  // Include $var in destructure if fragment has variables
  const destructure = hasVariables ? "fragment, $var" : "fragment";
  lines.push(`export const ${exportName} = gql.${options.schemaName}(({ ${destructure} }) =>`);
  lines.push(`  fragment.${fragment.onType}({`);

  // Variables block (if any)
  if (hasVariables) {
    lines.push(`    variables: { ${emitVariables(fragment.variables)} },`);
  }

  // Fields - include $ in context if fragment has variables
  // Pass fragment.onType as the parent type for list coercion
  const fieldsContext = hasVariables ? "{ f, $ }" : "{ f }";
  lines.push(`    fields: (${fieldsContext}) => ({`);
  const fieldLinesResult = emitSelections(fragment.selections, 3, fragment.variables, schema, fragment.onType);
  if (fieldLinesResult.isErr()) {
    return err(fieldLinesResult.error);
  }
  lines.push(fieldLinesResult.value);
  lines.push(`    }),`);

  lines.push(`  }),`);
  lines.push(`);`);

  return ok(lines.join("\n"));
};

/**
 * Common variable type for emission (both EnrichedVariable and InferredVariable have these fields).
 */
type EmittableVariable = {
  readonly name: string;
  readonly typeName: string;
  readonly modifier: string;
};

/**
 * Emit variable definitions.
 */
const emitVariables = (variables: readonly EmittableVariable[]): string => {
  return variables.map((v) => `...$var(${JSON.stringify(v.name)}).${v.typeName}(${JSON.stringify(v.modifier)})`).join(", ");
};

/**
 * Emit field selections (public API).
 * Converts variable array to Set<string> and delegates to internal implementation.
 */
const emitSelections = (
  selections: readonly ParsedSelection[],
  indent: number,
  variables: readonly EmittableVariable[],
  schema: SchemaIndex | null,
  parentTypeName: string | undefined,
): Result<string, GraphqlCompatError> => {
  const variableNames = new Set(variables.map((v) => v.name));
  return emitSelectionsInternal(selections, indent, variableNames, schema, parentTypeName);
};

/**
 * Internal implementation for emitting field selections.
 * Takes variableNames as Set<string> for recursive calls.
 */
const emitSelectionsInternal = (
  selections: readonly ParsedSelection[],
  indent: number,
  variableNames: Set<string>,
  schema: SchemaIndex | null,
  parentTypeName: string | undefined,
): Result<string, GraphqlCompatError> => {
  const lines: string[] = [];

  // Separate inline fragments from other selections
  const inlineFragments: ParsedInlineFragment[] = [];
  const otherSelections: ParsedSelection[] = [];

  for (const sel of selections) {
    if (sel.kind === "inlineFragment") {
      inlineFragments.push(sel);
    } else {
      otherSelections.push(sel);
    }
  }

  // Emit regular selections (fields and fragment spreads)
  for (const sel of otherSelections) {
    const result = emitSingleSelection(sel, indent, variableNames, schema, parentTypeName);
    if (result.isErr()) {
      return err(result.error);
    }
    lines.push(result.value);
  }

  // Emit grouped inline fragments as union selections
  if (inlineFragments.length > 0) {
    const unionResult = emitInlineFragmentsAsUnion(inlineFragments, indent, variableNames, schema);
    if (unionResult.isErr()) {
      return err(unionResult.error);
    }
    lines.push(unionResult.value);
  }

  return ok(lines.join("\n"));
};

/**
 * Emit a single selection (field or fragment spread).
 */
const emitSingleSelection = (
  sel: ParsedSelection,
  indent: number,
  variableNames: Set<string>,
  schema: SchemaIndex | null,
  parentTypeName: string | undefined,
): Result<string, GraphqlCompatError> => {
  const padding = "  ".repeat(indent);

  switch (sel.kind) {
    case "field":
      return emitFieldSelection(sel, indent, variableNames, schema, parentTypeName);
    case "fragmentSpread":
      return ok(`${padding}...${sel.name}Fragment.spread(),`);
    case "inlineFragment":
      // This should not happen as inline fragments are handled separately
      return ok("");
  }
};

/**
 * Emit inline fragments grouped as a union selection.
 * Format: { TypeA: ({ f }) => ({ ...fields }), TypeB: ({ f }) => ({ ...fields }) }
 */
const emitInlineFragmentsAsUnion = (
  inlineFragments: readonly ParsedInlineFragment[],
  indent: number,
  variableNames: Set<string>,
  schema: SchemaIndex | null,
): Result<string, GraphqlCompatError> => {
  const padding = "  ".repeat(indent);

  // Validate inline fragments have type conditions
  for (const frag of inlineFragments) {
    if (frag.onType === "") {
      return err({
        code: "GRAPHQL_INLINE_FRAGMENT_WITHOUT_TYPE",
        message: "Inline fragments without type condition are not supported. Use `... on TypeName { }` syntax.",
      });
    }
  }

  // Validate all inline fragments are on union types (not interfaces)
  for (const frag of inlineFragments) {
    if (schema && !schema.objects.has(frag.onType)) {
      // If it's not a known object type, it might be an interface
      // Check if any union contains this type as a member
      let isUnionMember = false;
      for (const [, unionDef] of schema.unions) {
        if (unionDef.members.has(frag.onType)) {
          isUnionMember = true;
          break;
        }
      }
      if (!isUnionMember) {
        return err({
          code: "GRAPHQL_INLINE_FRAGMENT_ON_INTERFACE",
          message: `Inline fragments on interface type "${frag.onType}" are not supported. Use union types instead.`,
          onType: frag.onType,
        });
      }
    }
  }

  // Build union member entries
  const entries: string[] = [];
  for (const frag of inlineFragments) {
    const innerPadding = "  ".repeat(indent + 1);
    // Use the inline fragment's type condition as the parent type for nested selections
    const fieldsResult = emitSelectionsInternal(frag.selections, indent + 2, variableNames, schema, frag.onType);
    if (fieldsResult.isErr()) {
      return err(fieldsResult.error);
    }

    entries.push(`${innerPadding}${frag.onType}: ({ f }) => ({
${fieldsResult.value}
${innerPadding}}),`);
  }

  // Emit as spread with union callback: ...f.fieldName()({ Type: ... })
  // Note: This assumes the parent field handles the union - we emit just the union object
  return ok(`${padding}...({
${entries.join("\n")}
${padding}}),`);
};

/**
 * Emit a single field selection.
 */
const emitFieldSelection = (
  field: ParsedSelection & { kind: "field" },
  indent: number,
  variableNames: Set<string>,
  schema: SchemaIndex | null,
  parentTypeName: string | undefined,
): Result<string, GraphqlCompatError> => {
  const padding = "  ".repeat(indent);

  // Extract optional fields for type narrowing
  const args = field.arguments;
  const selections = field.selections;
  const hasArgs = args && args.length > 0;
  const hasSelections = selections && selections.length > 0;

  // Use shorthand syntax for scalar fields (no args, no nested selections)
  if (!hasArgs && !hasSelections) {
    return ok(`${padding}${field.name}: true,`);
  }

  let line = `${padding}...f.${field.name}(`;

  if (hasArgs) {
    const argsResult = emitArguments(args, variableNames, schema, parentTypeName, field.name);
    if (argsResult.isErr()) {
      return err(argsResult.error);
    }
    line += argsResult.value;
  }

  line += ")";

  if (hasSelections) {
    // Check if selections contain inline fragments (union field)
    const hasInlineFragments = selections.some((s) => s.kind === "inlineFragment");

    // Determine nested parent type for recursive selections
    const nestedParentType =
      schema && parentTypeName ? (getFieldReturnType(schema, parentTypeName, field.name) ?? undefined) : undefined;

    if (hasInlineFragments) {
      // Union field: emit with union callback pattern
      const nestedResult = emitSelectionsInternal(selections, indent + 1, variableNames, schema, nestedParentType);
      if (nestedResult.isErr()) {
        return err(nestedResult.error);
      }
      line += "({\n";
      line += `${nestedResult.value}\n`;
      line += `${padding}})`;
    } else {
      // Regular nested selections
      line += "(({ f }) => ({\n";
      const nestedResult = emitSelectionsInternal(selections, indent + 1, variableNames, schema, nestedParentType);
      if (nestedResult.isErr()) {
        return err(nestedResult.error);
      }
      line += `${nestedResult.value}\n`;
      line += `${padding}}))`;
    }
  }

  line += ",";

  return ok(line);
};

// ============================================================================
// List Coercion Utilities
// ============================================================================

/**
 * Check if a modifier represents a list type (contains []).
 */
const isListModifier = (modifier: string): boolean => {
  return modifier.includes("[]");
};

/**
 * Determine if a value needs to be wrapped in an array for list coercion.
 * Returns true if:
 * - Expected type is a list
 * - Value is NOT already a list
 * - Value is NOT a variable (runtime handles coercion)
 * - Value is NOT null
 */
const needsListCoercion = (value: ParsedValue, expectedModifier: string | undefined): boolean => {
  // No coercion if no expected type info
  if (!expectedModifier) return false;

  // No coercion if expected type is not a list
  if (!isListModifier(expectedModifier)) return false;

  // No coercion for variables (runtime handles this)
  if (value.kind === "variable") return false;

  // No coercion for null
  if (value.kind === "null") return false;

  // No coercion if value is already a list
  if (value.kind === "list") return false;

  return true;
};

/**
 * Expected type information for a value.
 */
type ExpectedType = {
  readonly typeName: string;
  readonly modifier: string;
};

/**
 * Emit a value with type context for list coercion.
 */
const emitValueWithType = (
  value: ParsedValue,
  expectedType: ExpectedType | null,
  variableNames: Set<string>,
  schema: SchemaIndex | null,
): Result<string, GraphqlCompatError> => {
  // Check if list coercion is needed
  const shouldCoerce = needsListCoercion(value, expectedType?.modifier);

  // Handle object values with recursive type context
  if (value.kind === "object" && expectedType && schema) {
    return emitObjectWithType(value, expectedType.typeName, variableNames, schema, shouldCoerce);
  }

  // Emit the value normally
  const result = emitValue(value, variableNames);
  if (result.isErr()) return result;

  // Wrap in array if coercion needed
  if (shouldCoerce) {
    return ok(`[${result.value}]`);
  }

  return result;
};

/**
 * Emit an object value with type context for recursive list coercion.
 */
const emitObjectWithType = (
  value: ParsedValue & { kind: "object" },
  inputTypeName: string,
  variableNames: Set<string>,
  schema: SchemaIndex,
  wrapInArray: boolean,
): Result<string, GraphqlCompatError> => {
  if (value.fields.length === 0) {
    return ok(wrapInArray ? "[{}]" : "{}");
  }

  const entries: string[] = [];
  for (const f of value.fields) {
    // Look up field type from input object definition
    const fieldType = getInputFieldType(schema, inputTypeName, f.name);

    const result = emitValueWithType(f.value, fieldType, variableNames, schema);
    if (result.isErr()) {
      return err(result.error);
    }
    entries.push(`${f.name}: ${result.value}`);
  }

  const objectStr = `{ ${entries.join(", ")} }`;
  return ok(wrapInArray ? `[${objectStr}]` : objectStr);
};

// ============================================================================
// Argument Emission
// ============================================================================

/**
 * Emit field arguments with type context for list coercion.
 */
const emitArguments = (
  args: readonly ParsedArgument[],
  variableNames: Set<string>,
  schema: SchemaIndex | null,
  parentTypeName: string | undefined,
  fieldName: string | undefined,
): Result<string, GraphqlCompatError> => {
  if (args.length === 0) {
    return ok("");
  }

  const argEntries: string[] = [];
  for (const arg of args) {
    // Look up expected type from schema
    const expectedType =
      schema && parentTypeName && fieldName ? getArgumentType(schema, parentTypeName, fieldName, arg.name) : null;

    const result = emitValueWithType(arg.value, expectedType, variableNames, schema);
    if (result.isErr()) {
      return err(result.error);
    }
    argEntries.push(`${arg.name}: ${result.value}`);
  }
  return ok(`{ ${argEntries.join(", ")} }`);
};

/**
 * Emit a value (literal or variable reference).
 */
const emitValue = (value: ParsedValue, variableNames: Set<string>): Result<string, GraphqlCompatError> => {
  switch (value.kind) {
    case "variable":
      // Check if it's a declared variable
      if (variableNames.has(value.name)) {
        return ok(`$.${value.name}`);
      }
      return err({
        code: "GRAPHQL_UNDECLARED_VARIABLE",
        message: `Variable "$${value.name}" is not declared in the operation`,
        variableName: value.name,
      });
    case "int":
    case "float":
      return ok(value.value);
    case "string":
      return ok(JSON.stringify(value.value));
    case "boolean":
      return ok(value.value ? "true" : "false");
    case "null":
      return ok("null");
    case "enum":
      // Enums are emitted as string literals in soda-gql
      return ok(JSON.stringify(value.value));
    case "list": {
      const values: string[] = [];
      for (const v of value.values) {
        const result = emitValue(v, variableNames);
        if (result.isErr()) {
          return err(result.error);
        }
        values.push(result.value);
      }
      return ok(`[${values.join(", ")}]`);
    }
    case "object": {
      if (value.fields.length === 0) {
        return ok("{}");
      }
      const entries: string[] = [];
      for (const f of value.fields) {
        const result = emitValue(f.value, variableNames);
        if (result.isErr()) {
          return err(result.error);
        }
        entries.push(`${f.name}: ${result.value}`);
      }
      return ok(`{ ${entries.join(", ")} }`);
    }
  }
};
