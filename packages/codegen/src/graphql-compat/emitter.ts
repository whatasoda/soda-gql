/**
 * Emitter for generating TypeScript compat code from enriched operations.
 * @module
 */

import type { EnrichedFragment, EnrichedOperation, EnrichedVariable } from "./transformer";
import type { ParsedArgument, ParsedSelection, ParsedValue } from "./types";

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
};

/**
 * Emit TypeScript code for an operation.
 */
export const emitOperation = (operation: EnrichedOperation, options: EmitOptions): string => {
  const lines: string[] = [];

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
  const fieldLines = emitSelections(operation.selections, 3, operation.variables);
  lines.push(fieldLines);
  lines.push(`    }),`);

  lines.push(`  }),`);
  lines.push(`);`);

  return lines.join("\n");
};

/**
 * Emit TypeScript code for a fragment.
 */
export const emitFragment = (fragment: EnrichedFragment, options: EmitOptions): string => {
  const lines: string[] = [];

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
  const fieldLines = emitSelections(fragment.selections, 3, []);
  lines.push(fieldLines);
  lines.push(`    }),`);

  lines.push(`  }),`);
  lines.push(`);`);

  return lines.join("\n");
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
): string => {
  const variableNames = new Set(variables.map((v) => v.name));
  const padding = "  ".repeat(indent);
  const lines: string[] = [];

  for (const sel of selections) {
    switch (sel.kind) {
      case "field":
        lines.push(emitFieldSelection(sel, indent, variableNames));
        break;
      case "fragmentSpread":
        lines.push(`${padding}...${sel.name}Fragment.spread(),`);
        break;
      case "inlineFragment":
        // Inline fragments are more complex - emit as conditional selections
        // For now, we'll emit them as comments indicating they need manual handling
        lines.push(`${padding}// TODO: Inline fragment on ${sel.onType}`);
        for (const innerSel of sel.selections) {
          if (innerSel.kind === "field") {
            lines.push(emitFieldSelection(innerSel, indent, variableNames));
          }
        }
        break;
    }
  }

  return lines.join("\n");
};

/**
 * Emit a single field selection.
 */
const emitFieldSelection = (field: ParsedSelection & { kind: "field" }, indent: number, variableNames: Set<string>): string => {
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
    // Nested selections
    line += "(({ f }) => ({\n";
    const nestedLines = emitSelections(selections, indent + 1, []);
    line += `${nestedLines}\n`;
    line += `${padding}}))`;
  }

  line += ",";

  return line;
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
