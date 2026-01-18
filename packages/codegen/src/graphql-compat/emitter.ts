/**
 * Emitter for generating TypeScript compat code from enriched operations.
 * @module
 */

import type { DocumentNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import { createSchemaIndex } from "../generator";
import type { EnrichedFragment, EnrichedOperation, EnrichedVariable } from "./transformer";
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
  /** Map of fragment name to its import path (relative) */
  readonly fragmentImports?: ReadonlyMap<string, string>;
  /** Schema document for type lookups (required for inline fragment support) */
  readonly schemaDocument?: DocumentNode;
};

/**
 * Emit TypeScript code for an operation.
 */
export const emitOperation = (
  operation: EnrichedOperation,
  options: EmitOptions,
): Result<string, GraphqlCompatError> => {
  const lines: string[] = [];
  const schema = options.schemaDocument ? createSchemaIndex(options.schemaDocument) : null;

  // Generate imports
  lines.push(`import { gql } from "${options.graphqlSystemPath}";`);

  // Add fragment imports if needed
  if (operation.fragmentDependencies.length > 0 && options.fragmentImports) {
    for (const fragName of operation.fragmentDependencies) {
      const importPath = options.fragmentImports.get(fragName);
      if (importPath) {
        lines.push(`import { ${fragName}Fragment } from "${importPath}";`);
      }
    }
  }

  lines.push("");

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

  // Fields
  lines.push(`    fields: ({ f, $ }) => ({`);
  const fieldLinesResult = emitSelections(operation.selections, 3, operation.variables, schema);
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
export const emitFragment = (
  fragment: EnrichedFragment,
  options: EmitOptions,
): Result<string, GraphqlCompatError> => {
  const lines: string[] = [];
  const schema = options.schemaDocument ? createSchemaIndex(options.schemaDocument) : null;

  // Generate imports
  lines.push(`import { gql } from "${options.graphqlSystemPath}";`);

  // Add fragment imports if needed
  if (fragment.fragmentDependencies.length > 0 && options.fragmentImports) {
    for (const fragName of fragment.fragmentDependencies) {
      const importPath = options.fragmentImports.get(fragName);
      if (importPath) {
        lines.push(`import { ${fragName}Fragment } from "${importPath}";`);
      }
    }
  }

  lines.push("");

  // Generate export
  const exportName = `${fragment.name}Fragment`;

  lines.push(`export const ${exportName} = gql.${options.schemaName}(({ fragment }) =>`);
  lines.push(`  fragment.${fragment.onType}({`);

  // Fields
  lines.push(`    fields: ({ f }) => ({`);
  const fieldLinesResult = emitSelections(fragment.selections, 3, [], schema);
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
 * Emit variable definitions.
 */
const emitVariables = (variables: readonly EnrichedVariable[]): string => {
  return variables.map((v) => `...$var(${JSON.stringify(v.name)}).${v.typeName}(${JSON.stringify(v.modifier)})`).join(", ");
};

/**
 * Emit field selections.
 */
const emitSelections = (
  selections: readonly ParsedSelection[],
  indent: number,
  variables: readonly EnrichedVariable[],
  schema: SchemaIndex | null,
): Result<string, GraphqlCompatError> => {
  const variableNames = new Set(variables.map((v) => v.name));
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
    const result = emitSingleSelection(sel, indent, variableNames, schema);
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
): Result<string, GraphqlCompatError> => {
  const padding = "  ".repeat(indent);

  switch (sel.kind) {
    case "field":
      return emitFieldSelection(sel, indent, variableNames, schema);
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
  _variableNames: Set<string>,
  schema: SchemaIndex | null,
): Result<string, GraphqlCompatError> => {
  const padding = "  ".repeat(indent);

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
    const fieldsResult = emitSelections(frag.selections, indent + 2, [], schema);
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
): Result<string, GraphqlCompatError> => {
  const padding = "  ".repeat(indent);

  // Extract optional fields for type narrowing
  const args = field.arguments;
  const selections = field.selections;
  const hasArgs = args && args.length > 0;
  const hasSelections = selections && selections.length > 0;

  let line = `${padding}...f.${field.name}(`;

  if (hasArgs) {
    line += emitArguments(args, variableNames);
  }

  line += ")";

  if (hasSelections) {
    // Check if selections contain inline fragments (union field)
    const hasInlineFragments = selections.some((s) => s.kind === "inlineFragment");

    if (hasInlineFragments) {
      // Union field: emit with union callback pattern
      const nestedResult = emitSelections(selections, indent + 1, [], schema);
      if (nestedResult.isErr()) {
        return err(nestedResult.error);
      }
      line += "({\n";
      line += `${nestedResult.value}\n`;
      line += `${padding}})`;
    } else {
      // Regular nested selections
      line += "(({ f }) => ({\n";
      const nestedResult = emitSelections(selections, indent + 1, [], schema);
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

/**
 * Emit field arguments.
 */
const emitArguments = (args: readonly ParsedArgument[], variableNames: Set<string>): string => {
  if (args.length === 0) {
    return "";
  }

  const argEntries = args.map((arg) => `${arg.name}: ${emitValue(arg.value, variableNames)}`);
  return `{ ${argEntries.join(", ")} }`;
};

/**
 * Emit a value (literal or variable reference).
 */
const emitValue = (value: ParsedValue, variableNames: Set<string>): string => {
  switch (value.kind) {
    case "variable":
      // Check if it's a declared variable
      if (variableNames.has(value.name)) {
        return `$.${value.name}`;
      }
      // Undeclared variable - emit as string for now
      return `$${value.name}`;
    case "int":
    case "float":
      return value.value;
    case "string":
      return JSON.stringify(value.value);
    case "boolean":
      return value.value ? "true" : "false";
    case "null":
      return "null";
    case "enum":
      // Enums are emitted as string literals in soda-gql
      return JSON.stringify(value.value);
    case "list":
      return `[${value.values.map((v) => emitValue(v, variableNames)).join(", ")}]`;
    case "object": {
      if (value.fields.length === 0) {
        return "{}";
      }
      const entries = value.fields.map((f) => `${f.name}: ${emitValue(f.value, variableNames)}`);
      return `{ ${entries.join(", ")} }`;
    }
  }
};
