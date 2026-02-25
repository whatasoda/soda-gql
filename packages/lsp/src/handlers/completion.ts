/**
 * Completion handler: provides GraphQL autocompletion in templates.
 * @module
 */

import type { FragmentDefinitionNode, GraphQLSchema } from "graphql";
import { getAutocompleteSuggestions } from "graphql-language-service";
import type { CompletionItem } from "vscode-languageserver-types";
import { reconstructGraphql } from "../document-manager";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import {
  computeLineOffsets,
  createPositionMapper,
  offsetToPosition,
  type Position,
  positionToOffset,
  toIPosition,
} from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type HandleCompletionInput = {
  readonly template: ExtractedTemplate;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
  /** LSP Position (0-indexed line, 0-indexed character) in the TS file. */
  readonly tsPosition: Position;
  /** External fragment definitions for cross-file resolution. */
  readonly externalFragments?: readonly FragmentDefinitionNode[];
};

/** Handle a completion request for a GraphQL template. */
export const handleCompletion = (input: HandleCompletionInput): CompletionItem[] => {
  const { template, schema, tsSource, tsPosition } = input;
  const reconstructed = reconstructGraphql(template);
  const headerLen = reconstructed.length - template.content.length;
  const { preprocessed } = preprocessFragmentArgs(reconstructed);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  const contentPos = mapper.tsToGraphql(tsPosition);
  if (!contentPos) {
    return [];
  }

  // Shift content position to reconstructed position (account for synthesized header)
  const contentLineOffsets = computeLineOffsets(template.content);
  const contentOffset = positionToOffset(contentLineOffsets, contentPos);
  const reconstructedOffset = contentOffset + headerLen;
  const reconstructedLineOffsets = computeLineOffsets(preprocessed);
  const gqlPosition = offsetToPosition(reconstructedLineOffsets, reconstructedOffset);

  // graphql-language-service expects IPosition with line/character (0-indexed)
  const suggestions = getAutocompleteSuggestions(
    schema,
    preprocessed,
    toIPosition(gqlPosition),
    undefined,
    input.externalFragments as FragmentDefinitionNode[] | undefined,
  );

  return suggestions as CompletionItem[];
};
