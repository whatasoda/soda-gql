/**
 * GraphQL parser utilities.
 * Extracts operations and fragments from GraphQL source strings.
 * @module
 */

import {
  type ArgumentNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type InlineFragmentNode,
  Kind,
  type OperationDefinitionNode,
  parse,
  type SelectionNode,
  type TypeNode,
  type ValueNode,
  type VariableDefinitionNode,
} from "graphql";
import { err, ok, type Result } from "./result";

import type {
  GraphqlAnalysisError,
  ParsedArgument,
  ParsedFieldSelection,
  ParsedFragment,
  ParsedFragmentSpread,
  ParsedInlineFragment,
  ParsedOperation,
  ParsedSelection,
  ParsedValue,
  ParsedVariable,
  ParseResult,
  TypeInfo,
} from "./types";

/** Parse GraphQL source string directly. No file I/O. */
export const parseGraphqlSource = (
  source: string,
  sourceFile: string,
): Result<ParseResult, GraphqlAnalysisError> => {
  try {
    const document = parse(source);
    return ok({ document, ...extractFromDocument(document, sourceFile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "GRAPHQL_PARSE_ERROR",
      message: `GraphQL parse error: ${message}`,
      filePath: sourceFile,
    });
  }
};

/**
 * Parse a GraphQL TypeNode into type name and modifier.
 *
 * Format: inner nullability + list modifiers
 * - Inner: `!` (non-null) or `?` (nullable)
 * - List: `[]!` (non-null list) or `[]?` (nullable list)
 */
export const parseTypeNode = (node: TypeNode): TypeInfo => {
  type TypeLevel = { kind: "list" | "named"; nonNull: boolean };
  const levels: TypeLevel[] = [];

  const collect = (n: TypeNode, nonNull: boolean): string => {
    if (n.kind === Kind.NON_NULL_TYPE) {
      return collect(n.type, true);
    }
    if (n.kind === Kind.LIST_TYPE) {
      levels.push({ kind: "list", nonNull });
      return collect(n.type, false);
    }
    levels.push({ kind: "named", nonNull });
    return n.name.value;
  };

  const typeName = collect(node, false);

  // Build modifier from levels (reverse order)
  let modifier = "?";
  for (const level of levels.slice().reverse()) {
    if (level.kind === "named") {
      modifier = level.nonNull ? "!" : "?";
      continue;
    }
    const listSuffix = level.nonNull ? "[]!" : "[]?";
    modifier = `${modifier}${listSuffix}`;
  }

  return { typeName, modifier };
};

/** Extract operations and fragments from a parsed GraphQL document. */
const extractFromDocument = (
  document: DocumentNode,
  sourceFile: string,
): { operations: ParsedOperation[]; fragments: ParsedFragment[] } => {
  const operations: ParsedOperation[] = [];
  const fragments: ParsedFragment[] = [];

  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      const operation = extractOperation(definition, sourceFile);
      if (operation) {
        operations.push(operation);
      }
    } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.push(extractFragment(definition, sourceFile));
    }
  }

  return { operations, fragments };
};

/** Extract a single operation from an OperationDefinitionNode. */
const extractOperation = (node: OperationDefinitionNode, sourceFile: string): ParsedOperation | null => {
  if (!node.name) {
    return null;
  }

  const variables: ParsedVariable[] = (node.variableDefinitions ?? []).map(extractVariable);
  const selections = extractSelections(node.selectionSet.selections);

  return {
    kind: node.operation,
    name: node.name.value,
    variables,
    selections,
    sourceFile,
  };
};

/** Extract a fragment from a FragmentDefinitionNode. */
const extractFragment = (node: FragmentDefinitionNode, sourceFile: string): ParsedFragment => {
  const selections = extractSelections(node.selectionSet.selections);

  return {
    name: node.name.value,
    onType: node.typeCondition.name.value,
    selections,
    sourceFile,
  };
};

/** Extract a variable definition. */
const extractVariable = (node: VariableDefinitionNode): ParsedVariable => {
  const { typeName, modifier } = parseTypeNode(node.type);
  const defaultValue = node.defaultValue ? extractValue(node.defaultValue) : undefined;

  return {
    name: node.variable.name.value,
    typeName,
    modifier,
    typeKind: "scalar",
    defaultValue,
  };
};

/** Extract selections from a SelectionSet. */
const extractSelections = (selections: readonly SelectionNode[]): ParsedSelection[] => {
  return selections.map(extractSelection);
};

/** Extract a single selection. */
const extractSelection = (node: SelectionNode): ParsedSelection => {
  switch (node.kind) {
    case Kind.FIELD:
      return extractFieldSelection(node);
    case Kind.FRAGMENT_SPREAD:
      return extractFragmentSpread(node);
    case Kind.INLINE_FRAGMENT:
      return extractInlineFragment(node);
  }
};

/** Extract a field selection. */
const extractFieldSelection = (node: FieldNode): ParsedFieldSelection => {
  const args = node.arguments?.length ? node.arguments.map(extractArgument) : undefined;
  const selections = node.selectionSet ? extractSelections(node.selectionSet.selections) : undefined;

  return {
    kind: "field",
    name: node.name.value,
    alias: node.alias?.value,
    arguments: args,
    selections,
  };
};

/** Extract a fragment spread. */
const extractFragmentSpread = (node: FragmentSpreadNode): ParsedFragmentSpread => {
  return {
    kind: "fragmentSpread",
    name: node.name.value,
  };
};

/** Extract an inline fragment. */
const extractInlineFragment = (node: InlineFragmentNode): ParsedInlineFragment => {
  return {
    kind: "inlineFragment",
    onType: node.typeCondition?.name.value ?? "",
    selections: extractSelections(node.selectionSet.selections),
  };
};

/** Extract an argument. */
const extractArgument = (node: ArgumentNode): ParsedArgument => {
  return {
    name: node.name.value,
    value: extractValue(node.value),
  };
};

/** Assert unreachable code path (for exhaustiveness checks). */
const assertUnreachable = (value: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
};

/** Extract a value (literal or variable reference). */
const extractValue = (node: ValueNode): ParsedValue => {
  switch (node.kind) {
    case Kind.VARIABLE:
      return { kind: "variable", name: node.name.value };
    case Kind.INT:
      return { kind: "int", value: node.value };
    case Kind.FLOAT:
      return { kind: "float", value: node.value };
    case Kind.STRING:
      return { kind: "string", value: node.value };
    case Kind.BOOLEAN:
      return { kind: "boolean", value: node.value };
    case Kind.NULL:
      return { kind: "null" };
    case Kind.ENUM:
      return { kind: "enum", value: node.value };
    case Kind.LIST:
      return { kind: "list", values: node.values.map(extractValue) };
    case Kind.OBJECT:
      return {
        kind: "object",
        fields: node.fields.map((field) => ({
          name: field.name.value,
          value: extractValue(field.value),
        })),
      };
    default:
      return assertUnreachable(node);
  }
};
