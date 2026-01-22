/**
 * Transformer for enriching parsed GraphQL operations with schema information.
 * @module
 */

import type { DocumentNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import { createSchemaIndex } from "../generator";
import type { GraphqlCompatError, ParsedFragment, ParsedOperation, ParsedVariable, ParseResult } from "./types";

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
export const mergeModifiers = (a: string, b: string): { ok: true; value: string } | { ok: false; reason: string } => {
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

/**
 * Check if a type name is a scalar type.
 */
const isScalarName = (schema: SchemaIndex, name: string): boolean => builtinScalarTypes.has(name) || schema.scalars.has(name);

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
 * This resolves variable type kinds (scalar, enum, input) and collects
 * fragment dependencies.
 */
export const transformParsedGraphql = (
  parsed: ParseResult,
  options: TransformOptions,
): Result<TransformResult, GraphqlCompatError> => {
  const schema = createSchemaIndex(options.schemaDocument);

  // Transform operations
  const operations: EnrichedOperation[] = [];
  for (const op of parsed.operations) {
    const result = transformOperation(op, schema);
    if (result.isErr()) {
      return err(result.error);
    }
    operations.push(result.value);
  }

  // Transform fragments
  const fragments: EnrichedFragment[] = [];
  for (const frag of parsed.fragments) {
    const result = transformFragment(frag, schema);
    if (result.isErr()) {
      return err(result.error);
    }
    fragments.push(result.value);
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
 */
const transformFragment = (frag: ParsedFragment, _schema: SchemaIndex): Result<EnrichedFragment, GraphqlCompatError> => {
  // Collect fragment dependencies (fragments used within this fragment)
  const fragmentDependencies = collectFragmentDependencies(frag.selections);

  return ok({
    ...frag,
    fragmentDependencies,
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
