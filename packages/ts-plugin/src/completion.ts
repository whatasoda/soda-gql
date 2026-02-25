/**
 * GraphQL completion: converts template position to GraphQL suggestions.
 * @module
 */
import type { GraphQLSchema } from "graphql";
import { getAutocompleteSuggestions } from "graphql-language-service";
import type ts from "typescript";
import { computeLineOffsets, offsetToPosition, preprocessFragmentArgs, reconstructGraphql, toIPosition } from "./graphql-utils";
import type { TemplateInfo } from "./template-detector";

/**
 * Get GraphQL field completions for a position inside a tagged template.
 *
 * @param info - Template info from findTemplateAtPosition
 * @param schema - GraphQL schema for the template's schema name
 * @param tsPosition - Absolute character offset in the TS source file
 * @returns Array of TS CompletionEntry objects with GraphQL suggestions
 */
export const getGraphQLCompletions = (info: TemplateInfo, schema: GraphQLSchema, tsPosition: number): ts.CompletionEntry[] => {
  // Step 1: Reconstruct full GraphQL source with definition header
  const reconstructed = reconstructGraphql(info);
  const headerLen = reconstructed.length - info.content.length;

  // Step 2: Preprocess fragment arguments
  const preprocessed = preprocessFragmentArgs(reconstructed);

  // Step 3: Map TS file offset → content offset → reconstructed offset → line/character
  const contentOffset = tsPosition - info.contentStart;
  if (contentOffset < 0 || contentOffset > info.content.length) {
    return [];
  }

  const reconstructedOffset = contentOffset + headerLen;
  const reconstructedLineOffsets = computeLineOffsets(preprocessed);
  const gqlPosition = offsetToPosition(reconstructedLineOffsets, reconstructedOffset);

  // Step 4: Get suggestions from graphql-language-service
  const suggestions = getAutocompleteSuggestions(schema, preprocessed, toIPosition(gqlPosition));

  // Step 5: Convert CompletionItem[] to ts.CompletionEntry[]
  return suggestions.map((item) => ({
    name: item.label,
    kind: "property" as ts.ScriptElementKind,
    kindModifiers: "",
    sortText: item.sortText ?? item.label,
  }));
};
