/**
 * Transformer for enriching parsed GraphQL operations with schema information.
 * @module
 */

import type { DocumentNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import { createSchemaIndex } from "../generator";
import { parseTypeNode } from "./parser";
import type {
  GraphqlCompatError,
  InferredVariable,
  ParsedArgument,
  ParsedFragment,
  ParsedOperation,
  ParsedSelection,
  ParsedValue,
  ParsedVariable,
  ParseResult,
} from "./types";

/**
 * Schema index type extracted from generator.
 */
type SchemaIndex = ReturnType<typeof createSchemaIndex>;

/**
 * Built-in GraphQL scalar types.
 */
const builtinScalarTypes = new Set(["ID", "String", "Int", "Float", "Boolean"]);

// ============================================================================
// Modifier Merging Utilities
// ============================================================================

/**
 * Parsed structure of a modifier for comparison and merging.
 * Example: "![]?" -> { inner: "!", lists: ["[]?"] }
 */
type ModifierStructure = {
  readonly inner: "!" | "?";
  readonly lists: readonly ("[]!" | "[]?")[];
};

/**
 * Parse a modifier string into its structural components.
 * @param modifier - Modifier string like "!", "?", "![]!", "?[]?[]!"
 * @returns Parsed structure with inner nullability and list modifiers
 */
const parseModifierStructure = (modifier: string): ModifierStructure => {
  // Extract inner nullability (first character)
  const inner = modifier[0] === "!" ? "!" : "?";

  // Extract list modifiers ([]! or []?)
  const lists: ("[]!" | "[]?")[] = [];
  const listPattern = /\[\]([!?])/g;
  let match: RegExpExecArray | null;
  while ((match = listPattern.exec(modifier)) !== null) {
    lists.push(`[]${match[1]}` as "[]!" | "[]?");
  }

  return { inner, lists };
};

/**
 * Rebuild modifier string from structure.
 */
const buildModifier = (structure: ModifierStructure): string => {
  return structure.inner + structure.lists.join("");
};

/**
 * Merge two modifiers by taking the stricter constraint at each level.
 * - Non-null (!) is stricter than nullable (?)
 * - List depths must match
 *
 * @param a - First modifier
 * @param b - Second modifier
 * @returns Merged modifier or error if incompatible
 */
export const mergeModifiers = (
  a: string,
  b: string,
): { ok: true; value: string } | { ok: false; reason: string } => {
  const structA = parseModifierStructure(a);
  const structB = parseModifierStructure(b);

  // List depths must match
  if (structA.lists.length !== structB.lists.length) {
    return {
      ok: false,
      reason: `Incompatible list depths: "${a}" has ${structA.lists.length} list level(s), "${b}" has ${structB.lists.length}`,
    };
  }

  // Take stricter inner constraint (! beats ?)
  const mergedInner: "!" | "?" = structA.inner === "!" || structB.inner === "!" ? "!" : "?";

  // Merge each list level (! beats ?)
  const mergedLists: ("[]!" | "[]?")[] = [];
  for (let i = 0; i < structA.lists.length; i++) {
    const listA = structA.lists[i]!;
    const listB = structB.lists[i]!;
    mergedLists.push(listA === "[]!" || listB === "[]!" ? "[]!" : "[]?");
  }

  return { ok: true, value: buildModifier({ inner: mergedInner, lists: mergedLists }) };
};

// ============================================================================
// Variable Collection from Selections
// ============================================================================

/**
 * Intermediate type for tracking variable usages before merging.
 */
type VariableUsage = {
  readonly name: string;
  readonly typeName: string;
  readonly modifier: string;
  readonly typeKind: "scalar" | "enum" | "input";
};

/**
 * Get the expected type for a field argument from the schema.
 * Returns null if the field or argument is not found.
 */
const getArgumentType = (
  schema: SchemaIndex,
  parentTypeName: string,
  fieldName: string,
  argumentName: string,
): { typeName: string; modifier: string } | null => {
  const objectRecord = schema.objects.get(parentTypeName);
  if (!objectRecord) return null;

  const fieldDef = objectRecord.fields.get(fieldName);
  if (!fieldDef) return null;

  const argDef = fieldDef.arguments?.find((arg) => arg.name.value === argumentName);
  if (!argDef) return null;

  return parseTypeNode(argDef.type);
};

/**
 * Get the expected type for an input object field from the schema.
 */
const getInputFieldType = (
  schema: SchemaIndex,
  inputTypeName: string,
  fieldName: string,
): { typeName: string; modifier: string } | null => {
  const inputRecord = schema.inputs.get(inputTypeName);
  if (!inputRecord) return null;

  const fieldDef = inputRecord.fields.get(fieldName);
  if (!fieldDef) return null;

  return parseTypeNode(fieldDef.type);
};

/**
 * Resolve the type kind for a type name.
 */
const resolveTypeKindFromName = (schema: SchemaIndex, typeName: string): "scalar" | "enum" | "input" | null => {
  if (isScalarName(schema, typeName)) return "scalar";
  if (isEnumName(schema, typeName)) return "enum";
  if (schema.inputs.has(typeName)) return "input";
  return null;
};

/**
 * Extract variable usages from a parsed value, given the expected type.
 * Handles nested input objects recursively.
 */
const collectVariablesFromValue = (
  value: ParsedValue,
  expectedTypeName: string,
  expectedModifier: string,
  schema: SchemaIndex,
  usages: VariableUsage[],
): GraphqlCompatError | null => {
  if (value.kind === "variable") {
    const typeKind = resolveTypeKindFromName(schema, expectedTypeName);
    if (!typeKind) {
      return {
        code: "GRAPHQL_UNKNOWN_TYPE",
        message: `Unknown type "${expectedTypeName}" for variable "$${value.name}"`,
        typeName: expectedTypeName,
      };
    }
    usages.push({
      name: value.name,
      typeName: expectedTypeName,
      modifier: expectedModifier,
      typeKind,
    });
    return null;
  }

  if (value.kind === "object") {
    // For object values, check each field against input type definition
    for (const field of value.fields) {
      const fieldType = getInputFieldType(schema, expectedTypeName, field.name);
      if (!fieldType) {
        return {
          code: "GRAPHQL_UNKNOWN_FIELD",
          message: `Unknown field "${field.name}" on input type "${expectedTypeName}"`,
          typeName: expectedTypeName,
          fieldName: field.name,
        };
      }
      const error = collectVariablesFromValue(field.value, fieldType.typeName, fieldType.modifier, schema, usages);
      if (error) return error;
    }
    return null;
  }

  if (value.kind === "list") {
    // For list values, unwrap one level of list modifier
    // e.g., [ID!]! -> ID! for elements
    const struct = parseModifierStructure(expectedModifier);
    if (struct.lists.length > 0) {
      const innerModifier = buildModifier({
        inner: struct.inner,
        lists: struct.lists.slice(1),
      });
      for (const item of value.values) {
        const error = collectVariablesFromValue(item, expectedTypeName, innerModifier, schema, usages);
        if (error) return error;
      }
    }
  }

  // Other value kinds (int, float, string, etc.) don't contain variables
  return null;
};

/**
 * Collect variable usages from field arguments.
 */
const collectVariablesFromArguments = (
  args: readonly ParsedArgument[],
  parentTypeName: string,
  fieldName: string,
  schema: SchemaIndex,
  usages: VariableUsage[],
): GraphqlCompatError | null => {
  for (const arg of args) {
    const argType = getArgumentType(schema, parentTypeName, fieldName, arg.name);
    if (!argType) {
      return {
        code: "GRAPHQL_UNKNOWN_ARGUMENT",
        message: `Unknown argument "${arg.name}" on field "${fieldName}"`,
        fieldName,
        argumentName: arg.name,
      };
    }
    const error = collectVariablesFromValue(arg.value, argType.typeName, argType.modifier, schema, usages);
    if (error) return error;
  }
  return null;
};

/**
 * Recursively collect all variable usages from selections.
 */
export const collectVariableUsages = (
  selections: readonly ParsedSelection[],
  parentTypeName: string,
  schema: SchemaIndex,
): Result<VariableUsage[], GraphqlCompatError> => {
  const usages: VariableUsage[] = [];

  const collect = (sels: readonly ParsedSelection[], parentType: string): GraphqlCompatError | null => {
    for (const sel of sels) {
      switch (sel.kind) {
        case "field": {
          // Collect from arguments
          if (sel.arguments && sel.arguments.length > 0) {
            const error = collectVariablesFromArguments(sel.arguments, parentType, sel.name, schema, usages);
            if (error) return error;
          }

          // Recurse into nested selections
          if (sel.selections && sel.selections.length > 0) {
            // Need to determine the field's return type for nested selections
            const fieldReturnType = getFieldReturnType(schema, parentType, sel.name);
            if (!fieldReturnType) {
              return {
                code: "GRAPHQL_UNKNOWN_FIELD",
                message: `Unknown field "${sel.name}" on type "${parentType}"`,
                typeName: parentType,
                fieldName: sel.name,
              };
            }
            const error = collect(sel.selections, fieldReturnType);
            if (error) return error;
          }
          break;
        }
        case "inlineFragment": {
          // Use the inline fragment's type condition
          const error = collect(sel.selections, sel.onType);
          if (error) return error;
          break;
        }
        case "fragmentSpread":
          // Fragment spreads are handled separately (variables from spread fragments)
          break;
      }
    }
    return null;
  };

  const error = collect(selections, parentTypeName);
  if (error) return err(error);

  return ok(usages);
};

/**
 * Get the return type of a field (unwrapped from modifiers).
 */
const getFieldReturnType = (schema: SchemaIndex, parentTypeName: string, fieldName: string): string | null => {
  const objectRecord = schema.objects.get(parentTypeName);
  if (!objectRecord) return null;

  const fieldDef = objectRecord.fields.get(fieldName);
  if (!fieldDef) return null;

  const { typeName } = parseTypeNode(fieldDef.type);
  return typeName;
};

/**
 * Merge multiple variable usages into a single InferredVariable.
 * Validates type compatibility and merges modifiers using stricter constraint.
 */
export const mergeVariableUsages = (
  variableName: string,
  usages: readonly VariableUsage[],
): Result<InferredVariable, GraphqlCompatError> => {
  if (usages.length === 0) {
    // This shouldn't happen, but handle defensively
    return err({
      code: "GRAPHQL_UNDECLARED_VARIABLE",
      message: `No usages found for variable "${variableName}"`,
      variableName,
    });
  }

  const first = usages[0]!;

  // Validate all usages have the same type name
  for (const usage of usages) {
    if (usage.typeName !== first.typeName) {
      return err({
        code: "GRAPHQL_VARIABLE_TYPE_MISMATCH",
        message: `Variable "$${variableName}" has conflicting types: "${first.typeName}" and "${usage.typeName}"`,
        variableName,
      });
    }
  }

  // Merge modifiers
  let mergedModifier = first.modifier;
  for (let i = 1; i < usages.length; i++) {
    const result = mergeModifiers(mergedModifier, usages[i]!.modifier);
    if (!result.ok) {
      return err({
        code: "GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE",
        message: `Variable "$${variableName}" has incompatible modifiers: ${result.reason}`,
        variableName,
      });
    }
    mergedModifier = result.value;
  }

  return ok({
    name: variableName,
    typeName: first.typeName,
    modifier: mergedModifier,
    typeKind: first.typeKind,
  });
};

/**
 * Infer variables from collected usages.
 * Groups by variable name and merges each group.
 */
export const inferVariablesFromUsages = (
  usages: readonly VariableUsage[],
): Result<InferredVariable[], GraphqlCompatError> => {
  // Group usages by variable name
  const byName = new Map<string, VariableUsage[]>();
  for (const usage of usages) {
    const existing = byName.get(usage.name);
    if (existing) {
      existing.push(usage);
    } else {
      byName.set(usage.name, [usage]);
    }
  }

  // Merge each group
  const variables: InferredVariable[] = [];
  for (const [name, group] of byName) {
    const result = mergeVariableUsages(name, group);
    if (result.isErr()) return err(result.error);
    variables.push(result.value);
  }

  // Sort by name for deterministic output
  variables.sort((a, b) => a.name.localeCompare(b.name));

  return ok(variables);
};

/**
 * Check if a type name is a scalar type.
 */
const isScalarName = (schema: SchemaIndex, name: string): boolean => builtinScalarTypes.has(name) || schema.scalars.has(name);

// ============================================================================
// Fragment Dependency Ordering
// ============================================================================

/**
 * Topologically sort fragments so dependencies come before dependents.
 * Detects circular dependencies.
 *
 * Note: Uses the existing collectFragmentDependencies function defined below.
 */
export const sortFragmentsByDependency = (
  fragments: readonly ParsedFragment[],
): Result<ParsedFragment[], GraphqlCompatError> => {
  // Build dependency graph using existing function
  const graph = new Map<string, Set<string>>();
  for (const fragment of fragments) {
    const deps = collectFragmentDependenciesSet(fragment.selections);
    graph.set(fragment.name, deps);
  }

  const fragmentByName = new Map<string, ParsedFragment>();
  for (const f of fragments) {
    fragmentByName.set(f.name, f);
  }

  const sorted: ParsedFragment[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection

  const visit = (name: string, path: string[]): GraphqlCompatError | null => {
    if (visited.has(name)) return null;

    if (visiting.has(name)) {
      // Found a cycle
      const cycleStart = path.indexOf(name);
      const cycle = path.slice(cycleStart).concat(name);
      return {
        code: "GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY",
        message: `Circular dependency detected in fragments: ${cycle.join(" -> ")}`,
        fragmentNames: cycle,
      };
    }

    // Fragment might not be in our list (external dependency)
    const fragment = fragmentByName.get(name);
    if (!fragment) {
      // External fragment, skip
      visited.add(name);
      return null;
    }

    visiting.add(name);
    const deps = graph.get(name) ?? new Set();

    for (const dep of deps) {
      const error = visit(dep, [...path, name]);
      if (error) return error;
    }

    visiting.delete(name);
    visited.add(name);
    sorted.push(fragment);
    return null;
  };

  for (const fragment of fragments) {
    const error = visit(fragment.name, []);
    if (error) return err(error);
  }

  return ok(sorted);
};

/**
 * Recursively collect fragment spread names from selections into a Set.
 * Internal helper for sortFragmentsByDependency.
 */
const collectFragmentDependenciesSet = (selections: readonly ParsedSelection[]): Set<string> => {
  const deps = new Set<string>();

  const collect = (sels: readonly ParsedSelection[]): void => {
    for (const sel of sels) {
      switch (sel.kind) {
        case "fragmentSpread":
          deps.add(sel.name);
          break;
        case "field":
          if (sel.selections) {
            collect(sel.selections);
          }
          break;
        case "inlineFragment":
          collect(sel.selections);
          break;
      }
    }
  };

  collect(selections);
  return deps;
};

/**
 * Check if a type name is an enum type.
 */
const isEnumName = (schema: SchemaIndex, name: string): boolean => schema.enums.has(name);

/**
 * Enriched operation with resolved type information.
 */
export type EnrichedOperation = Omit<ParsedOperation, "variables"> & {
  readonly variables: readonly EnrichedVariable[];
  /** Fragment names used in this operation (for imports) */
  readonly fragmentDependencies: readonly string[];
};

/**
 * Enriched fragment with resolved type information.
 */
export type EnrichedFragment = ParsedFragment & {
  /** Fragment names used in this fragment (for imports) */
  readonly fragmentDependencies: readonly string[];
  /** Variables inferred from field arguments in this fragment */
  readonly variables: readonly InferredVariable[];
};

/**
 * Enriched variable with resolved type kind.
 */
export type EnrichedVariable = Omit<ParsedVariable, "typeKind"> & {
  readonly typeKind: "scalar" | "enum" | "input";
};

/**
 * Result of transforming parsed operations.
 */
export type TransformResult = {
  readonly operations: readonly EnrichedOperation[];
  readonly fragments: readonly EnrichedFragment[];
};

/**
 * Options for transformation.
 */
export type TransformOptions = {
  /** Schema document for type resolution */
  readonly schemaDocument: DocumentNode;
};

/**
 * Transform parsed operations/fragments by enriching them with schema information.
 *
 * This resolves variable type kinds (scalar, enum, input), collects
 * fragment dependencies, and infers variables for fragments.
 */
export const transformParsedGraphql = (
  parsed: ParseResult,
  options: TransformOptions,
): Result<TransformResult, GraphqlCompatError> => {
  const schema = createSchemaIndex(options.schemaDocument);

  // Sort fragments by dependency (dependencies first)
  const sortResult = sortFragmentsByDependency(parsed.fragments);
  if (sortResult.isErr()) {
    return err(sortResult.error);
  }
  const sortedFragments = sortResult.value;

  // Transform fragments in dependency order, building up resolved variables map
  const resolvedFragmentVariables = new Map<string, readonly InferredVariable[]>();
  const fragments: EnrichedFragment[] = [];

  for (const frag of sortedFragments) {
    const result = transformFragment(frag, schema, resolvedFragmentVariables);
    if (result.isErr()) {
      return err(result.error);
    }
    resolvedFragmentVariables.set(frag.name, result.value.variables);
    fragments.push(result.value);
  }

  // Transform operations
  const operations: EnrichedOperation[] = [];
  for (const op of parsed.operations) {
    const result = transformOperation(op, schema);
    if (result.isErr()) {
      return err(result.error);
    }
    operations.push(result.value);
  }

  return ok({ operations, fragments });
};

/**
 * Transform a single operation.
 */
const transformOperation = (op: ParsedOperation, schema: SchemaIndex): Result<EnrichedOperation, GraphqlCompatError> => {
  // Resolve variable type kinds
  const variables: EnrichedVariable[] = [];
  for (const v of op.variables) {
    const typeKind = resolveTypeKind(schema, v.typeName);
    if (typeKind === null) {
      return err({
        code: "GRAPHQL_UNKNOWN_TYPE",
        message: `Unknown type "${v.typeName}" in variable "${v.name}"`,
        typeName: v.typeName,
      });
    }
    variables.push({ ...v, typeKind });
  }

  // Collect fragment dependencies
  const fragmentDependencies = collectFragmentDependencies(op.selections);

  return ok({
    ...op,
    variables,
    fragmentDependencies,
  });
};

/**
 * Transform a single fragment.
 * Infers variables from field arguments and propagates variables from spread fragments.
 */
const transformFragment = (
  frag: ParsedFragment,
  schema: SchemaIndex,
  resolvedFragmentVariables: Map<string, readonly InferredVariable[]>,
): Result<EnrichedFragment, GraphqlCompatError> => {
  // Collect fragment dependencies (fragments used within this fragment)
  const fragmentDependencies = collectFragmentDependencies(frag.selections);

  // Collect direct variable usages from this fragment's selections
  const directUsagesResult = collectVariableUsages(frag.selections, frag.onType, schema);
  if (directUsagesResult.isErr()) {
    return err(directUsagesResult.error);
  }
  const directUsages = directUsagesResult.value;

  // Collect variables from spread fragments
  const spreadVariables: InferredVariable[] = [];
  for (const depName of fragmentDependencies) {
    const depVariables = resolvedFragmentVariables.get(depName);
    if (depVariables) {
      spreadVariables.push(...depVariables);
    }
    // If not found, it's an external fragment - skip
  }

  // Combine direct usages with spread variables
  // Convert spread variables to usages for merging
  const allUsages = [
    ...directUsages,
    ...spreadVariables.map((v) => ({
      name: v.name,
      typeName: v.typeName,
      modifier: v.modifier,
      typeKind: v.typeKind,
    })),
  ];

  // Infer final variables
  const variablesResult = inferVariablesFromUsages(allUsages);
  if (variablesResult.isErr()) {
    return err(variablesResult.error);
  }

  return ok({
    ...frag,
    fragmentDependencies,
    variables: variablesResult.value,
  });
};

/**
 * Resolve the type kind for a type name.
 */
const resolveTypeKind = (schema: SchemaIndex, typeName: string): "scalar" | "enum" | "input" | null => {
  if (isScalarName(schema, typeName)) {
    return "scalar";
  }
  if (isEnumName(schema, typeName)) {
    return "enum";
  }
  if (schema.inputs.has(typeName)) {
    return "input";
  }
  return null;
};

/**
 * Collect fragment names used in selections (recursively).
 */
const collectFragmentDependencies = (selections: readonly import("./types").ParsedSelection[]): readonly string[] => {
  const fragments = new Set<string>();

  const collect = (sels: readonly import("./types").ParsedSelection[]): void => {
    for (const sel of sels) {
      switch (sel.kind) {
        case "fragmentSpread":
          fragments.add(sel.name);
          break;
        case "field":
          if (sel.selections) {
            collect(sel.selections);
          }
          break;
        case "inlineFragment":
          collect(sel.selections);
          break;
      }
    }
  };

  collect(selections);
  return [...fragments];
};
