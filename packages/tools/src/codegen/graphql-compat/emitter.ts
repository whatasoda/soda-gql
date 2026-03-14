/**
 * Emitter for generating TypeScript compat code from enriched operations.
 *
 * Emits tagged template compat syntax by using `print()` from `graphql`
 * to reconstruct the GraphQL body from the original AST definition nodes.
 * @module
 */

import { type DocumentNode, Kind, type OperationDefinitionNode, type FragmentDefinitionNode, print } from "graphql";
import { ok, type Result } from "neverthrow";
import type { EnrichedFragment, EnrichedOperation, GraphqlCompatError } from "./types";

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
  /** Operation document containing parsed definitions (for print-based emission) */
  readonly operationDocument?: DocumentNode;
};

/**
 * Extract the GraphQL body from a printed operation definition.
 *
 * Given a printed operation like:
 *   `query GetUsers($limit: Int!) {\n  users(limit: $limit) {\n    id\n    name\n  }\n}`
 * Returns the body after stripping the `query GetUsers` prefix:
 *   `($limit: Int!) {\n  users(limit: $limit) {\n    id\n    name\n  }\n}`
 *
 * For operations without variables:
 *   `query GetUsers {\n  users {\n    id\n  }\n}`
 * Returns:
 *   `{\n  users {\n    id\n  }\n}`
 */
const extractOperationBody = (printed: string, operationName: string): string => {
  // Strip the "query OperationName" or "mutation OperationName" prefix
  // The prefix format is: `{kind} {name}` possibly followed by `(` for variables or ` {` for body
  const prefixPattern = new RegExp(`^\\w+\\s+${escapeRegExp(operationName)}\\s*`);
  return printed.replace(prefixPattern, "");
};

/**
 * Extract the GraphQL body (selection set) from a printed fragment definition.
 *
 * Given a printed fragment like:
 *   `fragment UserFields on User {\n  id\n  name\n}`
 * Returns just the selection set:
 *   `{\n  id\n  name\n}`
 */
const extractFragmentBody = (printed: string, fragmentName: string, onType: string): string => {
  const prefixPattern = new RegExp(`^fragment\\s+${escapeRegExp(fragmentName)}\\s+on\\s+${escapeRegExp(onType)}\\s*`);
  return printed.replace(prefixPattern, "");
};

/**
 * Escape special regex characters in a string.
 */
const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Collapse a multi-line GraphQL body into a single line.
 * Replaces newlines and consecutive whitespace with single spaces.
 */
const collapseToSingleLine = (body: string): string => {
  return body.replace(/\s+/g, " ").trim();
};

/**
 * Find an OperationDefinitionNode by name in a DocumentNode.
 */
const findOperationNode = (document: DocumentNode, name: string): OperationDefinitionNode | undefined => {
  for (const def of document.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION && def.name?.value === name) {
      return def;
    }
  }
  return undefined;
};

/**
 * Find a FragmentDefinitionNode by name in a DocumentNode.
 */
const findFragmentNode = (document: DocumentNode, name: string): FragmentDefinitionNode | undefined => {
  for (const def of document.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === name) {
      return def;
    }
  }
  return undefined;
};

/**
 * Emit TypeScript code for an operation.
 */
export const emitOperation = (operation: EnrichedOperation, options: EmitOptions): Result<string, GraphqlCompatError> => {
  const operationType = operation.kind;
  const exportName = `${operation.name}Compat`;

  // Get the GraphQL body from the original AST node
  let graphqlBody: string;
  if (options.operationDocument) {
    const node = findOperationNode(options.operationDocument, operation.name);
    if (node) {
      const printed = print(node);
      graphqlBody = collapseToSingleLine(extractOperationBody(printed, operation.name));
    } else {
      // Fallback: should not happen if document is correct
      graphqlBody = "{ }";
    }
  } else {
    // Fallback when no operation document is provided
    graphqlBody = "{ }";
  }

  const lines: string[] = [];
  lines.push(`export const ${exportName} = gql.${options.schemaName}(({ ${operationType} }) =>`);
  lines.push(`  ${operationType}.compat(${JSON.stringify(operation.name)})\`${graphqlBody}\`,`);
  lines.push(`);`);

  return ok(lines.join("\n"));
};

/**
 * Emit TypeScript code for a fragment.
 */
export const emitFragment = (fragment: EnrichedFragment, options: EmitOptions): Result<string, GraphqlCompatError> => {
  const exportName = `${fragment.name}Fragment`;

  // Get the GraphQL body from the original AST node
  let graphqlBody: string;
  if (options.operationDocument) {
    const node = findFragmentNode(options.operationDocument, fragment.name);
    if (node) {
      const printed = print(node);
      graphqlBody = collapseToSingleLine(extractFragmentBody(printed, fragment.name, fragment.onType));
    } else {
      graphqlBody = "{ }";
    }
  } else {
    graphqlBody = "{ }";
  }

  const lines: string[] = [];
  lines.push(`export const ${exportName} = gql.${options.schemaName}(({ fragment }) =>`);
  lines.push(`  fragment(${JSON.stringify(fragment.name)}, ${JSON.stringify(fragment.onType)})\`${graphqlBody}\`,`);
  lines.push(`);`);

  return ok(lines.join("\n"));
};
