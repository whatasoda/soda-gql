/**
 * Transformer for enriching parsed GraphQL operations with schema information.
 * @module
 */

import type { DocumentNode } from "graphql";
import { err, ok, type Result } from "./result";
import { createSchemaIndex, type SchemaIndex } from "./schema-index";
import { parseTypeNode } from "./parser";
import type {
  GraphqlAnalysisError,
  InferredVariable,
  ParsedArgument,
  ParsedFragment,
  ParsedOperation,
  ParsedSelection,
  ParsedValue,
  ParsedVariable,
  ParseResult,
  TypeInfo,
} from "./types";

const builtinScalarTypes = new Set(["ID", "String", "Int", "Float", "Boolean"]);

// ============================================================================
// Modifier Merging Utilities
// ============================================================================

type ModifierStructure = {
  readonly inner: "!" | "?";
  readonly lists: readonly ("[]!" | "[]?")[];
};

const parseModifierStructure = (modifier: string): ModifierStructure => {
  const inner = modifier[0] === "!" ? "!" : "?";
  const lists: ("[]!" | "[]?")[] = [];
  const listPattern = /\[\]([!?])/g;
  let match: RegExpExecArray | null;
  while ((match = listPattern.exec(modifier)) !== null) {
    lists.push(`[]${match[1]}` as "[]!" | "[]?");
  }
  return { inner, lists };
};

const buildModifier = (structure: ModifierStructure): string => {
  return structure.inner + structure.lists.join("");
};

export const isModifierAssignable = (source: string, target: string): boolean => {
  const srcStruct = parseModifierStructure(source);
  const tgtStruct = parseModifierStructure(target);

  const depthDiff = tgtStruct.lists.length - srcStruct.lists.length;
  if (depthDiff < 0 || depthDiff > 1) return false;

  const tgtListsToCompare = depthDiff === 1 ? tgtStruct.lists.slice(1) : tgtStruct.lists;

  if (depthDiff === 1 && srcStruct.lists.length === 0 && srcStruct.inner === "?" && tgtStruct.lists[0] === "[]!") {
    return false;
  }

  if (srcStruct.inner === "?" && tgtStruct.inner === "!") return false;

  for (let i = 0; i < srcStruct.lists.length; i++) {
    const srcList = srcStruct.lists[i]!;
    const tgtList = tgtListsToCompare[i]!;
    if (srcList === "[]?" && tgtList === "[]!") return false;
  }

  return true;
};

const deriveMinimumModifier = (expectedModifier: string): string => {
  const struct = parseModifierStructure(expectedModifier);
  if (struct.lists.length > 0) {
    return buildModifier({ inner: struct.inner, lists: struct.lists.slice(1) });
  }
  return expectedModifier;
};

export const mergeModifiers = (a: string, b: string): { ok: true; value: string } | { ok: false; reason: string } => {
  const structA = parseModifierStructure(a);
  const structB = parseModifierStructure(b);

  if (structA.lists.length !== structB.lists.length) {
    return {
      ok: false,
      reason: `Incompatible list depths: "${a}" has ${structA.lists.length} list level(s), "${b}" has ${structB.lists.length}`,
    };
  }

  const mergedInner: "!" | "?" = structA.inner === "!" || structB.inner === "!" ? "!" : "?";
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

export type VariableUsage = {
  readonly name: string;
  readonly typeName: string;
  readonly expectedModifier: string;
  readonly minimumModifier: string;
  readonly typeKind: "scalar" | "enum" | "input";
};

export const getArgumentType = (
  schema: SchemaIndex,
  parentTypeName: string,
  fieldName: string,
  argumentName: string,
): TypeInfo | null => {
  const objectRecord = schema.objects.get(parentTypeName);
  if (!objectRecord) return null;

  const fieldDef = objectRecord.fields.get(fieldName);
  if (!fieldDef) return null;

  const argDef = fieldDef.arguments?.find((arg) => arg.name.value === argumentName);
  if (!argDef) return null;

  return parseTypeNode(argDef.type);
};

export const getInputFieldType = (schema: SchemaIndex, inputTypeName: string, fieldName: string): TypeInfo | null => {
  const inputRecord = schema.inputs.get(inputTypeName);
  if (!inputRecord) return null;

  const fieldDef = inputRecord.fields.get(fieldName);
  if (!fieldDef) return null;

  return parseTypeNode(fieldDef.type);
};

const resolveTypeKindFromName = (schema: SchemaIndex, typeName: string): "scalar" | "enum" | "input" | null => {
  if (isScalarName(schema, typeName)) return "scalar";
  if (isEnumName(schema, typeName)) return "enum";
  if (schema.inputs.has(typeName)) return "input";
  return null;
};

const collectVariablesFromValue = (
  value: ParsedValue,
  expectedTypeName: string,
  expectedModifier: string,
  schema: SchemaIndex,
  usages: VariableUsage[],
): GraphqlAnalysisError | null => {
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
      expectedModifier,
      minimumModifier: deriveMinimumModifier(expectedModifier),
      typeKind,
    });
    return null;
  }

  if (value.kind === "object") {
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

  return null;
};

const collectVariablesFromArguments = (
  args: readonly ParsedArgument[],
  parentTypeName: string,
  fieldName: string,
  schema: SchemaIndex,
  usages: VariableUsage[],
): GraphqlAnalysisError | null => {
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

export const collectVariableUsages = (
  selections: readonly ParsedSelection[],
  parentTypeName: string,
  schema: SchemaIndex,
): Result<VariableUsage[], GraphqlAnalysisError> => {
  const usages: VariableUsage[] = [];

  const collect = (sels: readonly ParsedSelection[], parentType: string): GraphqlAnalysisError | null => {
    for (const sel of sels) {
      switch (sel.kind) {
        case "field": {
          if (sel.arguments && sel.arguments.length > 0) {
            const error = collectVariablesFromArguments(sel.arguments, parentType, sel.name, schema, usages);
            if (error) return error;
          }
          if (sel.selections && sel.selections.length > 0) {
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
          const error = collect(sel.selections, sel.onType);
          if (error) return error;
          break;
        }
        case "fragmentSpread":
          break;
      }
    }
    return null;
  };

  const error = collect(selections, parentTypeName);
  if (error) return err(error);

  return ok(usages);
};

export const getFieldReturnType = (schema: SchemaIndex, parentTypeName: string, fieldName: string): string | null => {
  const objectRecord = schema.objects.get(parentTypeName);
  if (!objectRecord) return null;

  const fieldDef = objectRecord.fields.get(fieldName);
  if (!fieldDef) return null;

  const { typeName } = parseTypeNode(fieldDef.type);
  return typeName;
};

export const mergeVariableUsages = (
  variableName: string,
  usages: readonly VariableUsage[],
): Result<InferredVariable, GraphqlAnalysisError> => {
  if (usages.length === 0) {
    return err({
      code: "GRAPHQL_UNDECLARED_VARIABLE",
      message: `No usages found for variable "${variableName}"`,
      variableName,
    });
  }

  const first = usages[0]!;

  for (const usage of usages) {
    if (usage.typeName !== first.typeName) {
      return err({
        code: "GRAPHQL_VARIABLE_TYPE_MISMATCH",
        message: `Variable "$${variableName}" has conflicting types: "${first.typeName}" and "${usage.typeName}"`,
        variableName,
      });
    }
  }

  let candidateModifier = first.minimumModifier;
  for (let i = 1; i < usages.length; i++) {
    const result = mergeModifiers(candidateModifier, usages[i]!.minimumModifier);
    if (!result.ok) {
      return err({
        code: "GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE",
        message: `Variable "$${variableName}" has incompatible modifiers: ${result.reason}`,
        variableName,
      });
    }
    candidateModifier = result.value;
  }

  for (const usage of usages) {
    if (!isModifierAssignable(candidateModifier, usage.expectedModifier)) {
      return err({
        code: "GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE",
        message: `Variable "$${variableName}" with modifier "${candidateModifier}" cannot satisfy expected "${usage.expectedModifier}"`,
        variableName,
      });
    }
  }

  return ok({
    name: variableName,
    typeName: first.typeName,
    modifier: candidateModifier,
    typeKind: first.typeKind,
  });
};

export const inferVariablesFromUsages = (
  usages: readonly VariableUsage[],
): Result<InferredVariable[], GraphqlAnalysisError> => {
  const byName = new Map<string, VariableUsage[]>();
  for (const usage of usages) {
    const existing = byName.get(usage.name);
    if (existing) {
      existing.push(usage);
    } else {
      byName.set(usage.name, [usage]);
    }
  }

  const variables: InferredVariable[] = [];
  for (const [name, group] of byName) {
    const result = mergeVariableUsages(name, group);
    if (!result.ok) return err(result.error);
    variables.push(result.value);
  }

  variables.sort((a, b) => a.name.localeCompare(b.name));
  return ok(variables);
};

const isScalarName = (schema: SchemaIndex, name: string): boolean =>
  builtinScalarTypes.has(name) || schema.scalars.has(name);

// ============================================================================
// Fragment Dependency Ordering
// ============================================================================

export const sortFragmentsByDependency = (
  fragments: readonly ParsedFragment[],
): Result<ParsedFragment[], GraphqlAnalysisError> => {
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
  const visiting = new Set<string>();

  const visit = (name: string, path: string[]): GraphqlAnalysisError | null => {
    if (visited.has(name)) return null;

    if (visiting.has(name)) {
      const cycleStart = path.indexOf(name);
      const cycle = path.slice(cycleStart).concat(name);
      return {
        code: "GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY",
        message: `Circular dependency detected in fragments: ${cycle.join(" -> ")}`,
        fragmentNames: cycle,
      };
    }

    const fragment = fragmentByName.get(name);
    if (!fragment) {
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

const isEnumName = (schema: SchemaIndex, name: string): boolean => schema.enums.has(name);

// ============================================================================
// Enriched Types
// ============================================================================

export type EnrichedOperation = Omit<ParsedOperation, "variables"> & {
  readonly variables: readonly EnrichedVariable[];
  readonly fragmentDependencies: readonly string[];
};

export type EnrichedFragment = ParsedFragment & {
  readonly fragmentDependencies: readonly string[];
  readonly variables: readonly InferredVariable[];
};

export type EnrichedVariable = Omit<ParsedVariable, "typeKind"> & {
  readonly typeKind: "scalar" | "enum" | "input";
};

export type TransformResult = {
  readonly operations: readonly EnrichedOperation[];
  readonly fragments: readonly EnrichedFragment[];
};

export type TransformOptions = {
  readonly schemaDocument: DocumentNode;
};

// ============================================================================
// Full Transformation Pipeline
// ============================================================================

export const transformParsedGraphql = (
  parsed: ParseResult,
  options: TransformOptions,
): Result<TransformResult, GraphqlAnalysisError> => {
  const schema = createSchemaIndex(options.schemaDocument);

  const sortResult = sortFragmentsByDependency(parsed.fragments);
  if (!sortResult.ok) {
    return err(sortResult.error);
  }
  const sortedFragments = sortResult.value;

  const resolvedFragmentVariables = new Map<string, readonly InferredVariable[]>();
  const fragments: EnrichedFragment[] = [];

  for (const frag of sortedFragments) {
    const result = transformFragment(frag, schema, resolvedFragmentVariables);
    if (!result.ok) {
      return err(result.error);
    }
    resolvedFragmentVariables.set(frag.name, result.value.variables);
    fragments.push(result.value);
  }

  const operations: EnrichedOperation[] = [];
  for (const op of parsed.operations) {
    const result = transformOperation(op, schema);
    if (!result.ok) {
      return err(result.error);
    }
    operations.push(result.value);
  }

  return ok({ operations, fragments });
};

const transformOperation = (
  op: ParsedOperation,
  schema: SchemaIndex,
): Result<EnrichedOperation, GraphqlAnalysisError> => {
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

  const fragmentDependencies = collectFragmentDependencies(op.selections);

  return ok({
    ...op,
    variables,
    fragmentDependencies,
  });
};

const transformFragment = (
  frag: ParsedFragment,
  schema: SchemaIndex,
  resolvedFragmentVariables: Map<string, readonly InferredVariable[]>,
): Result<EnrichedFragment, GraphqlAnalysisError> => {
  const fragmentDependencies = collectFragmentDependencies(frag.selections);

  const directUsagesResult = collectVariableUsages(frag.selections, frag.onType, schema);
  if (!directUsagesResult.ok) {
    return err(directUsagesResult.error);
  }
  const directUsages = directUsagesResult.value;

  const spreadVariables: InferredVariable[] = [];
  for (const depName of fragmentDependencies) {
    const depVariables = resolvedFragmentVariables.get(depName);
    if (depVariables) {
      spreadVariables.push(...depVariables);
    }
  }

  const allUsages: VariableUsage[] = [
    ...directUsages,
    ...spreadVariables.map((v) => ({
      name: v.name,
      typeName: v.typeName,
      expectedModifier: v.modifier,
      minimumModifier: v.modifier,
      typeKind: v.typeKind,
    })),
  ];

  const variablesResult = inferVariablesFromUsages(allUsages);
  if (!variablesResult.ok) {
    return err(variablesResult.error);
  }

  return ok({
    ...frag,
    fragmentDependencies,
    variables: variablesResult.value,
  });
};

const resolveTypeKind = (schema: SchemaIndex, typeName: string): "scalar" | "enum" | "input" | null => {
  if (isScalarName(schema, typeName)) return "scalar";
  if (isEnumName(schema, typeName)) return "enum";
  if (schema.inputs.has(typeName)) return "input";
  return null;
};

const collectFragmentDependencies = (selections: readonly ParsedSelection[]): readonly string[] => {
  const fragments = new Set<string>();

  const collect = (sels: readonly ParsedSelection[]): void => {
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
