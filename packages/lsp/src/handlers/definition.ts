/**
 * Definition handler: provides go-to-definition for fragment spreads.
 * @module
 */

import { getDefinitionQueryResultForFragmentSpread } from "graphql-language-service";
import type { Location } from "vscode-languageserver-types";
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
import type { ExtractedTemplate, IndexedFragment } from "../types";
import { findFragmentSpreadAtOffset } from "./_utils";

export type HandleDefinitionInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  /** LSP Position (0-indexed line, 0-indexed character) in the TS file. */
  readonly tsPosition: Position;
  /** External fragment definitions for cross-file resolution. */
  readonly externalFragments: readonly IndexedFragment[];
};

/** Handle a definition request for a GraphQL template. */
export const handleDefinition = async (input: HandleDefinitionInput): Promise<Location[]> => {
  const { template, tsSource, tsPosition, externalFragments } = input;
  const reconstructed = reconstructGraphql(template);
  const headerLen = reconstructed.length - template.content.length;
  const { preprocessed } = preprocessFragmentArgs(reconstructed);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  const gqlPosition = mapper.tsToGraphql(tsPosition);
  if (!gqlPosition) {
    return [];
  }

  // Convert from content-relative position to reconstructed-relative offset
  const contentLineOffsets = computeLineOffsets(template.content);
  const contentOffset = positionToOffset(contentLineOffsets, gqlPosition);
  const reconstructedOffset = contentOffset + headerLen;

  const fragmentSpread = findFragmentSpreadAtOffset(preprocessed, reconstructedOffset);
  if (!fragmentSpread) {
    return [];
  }

  // Build FragmentInfo[] from external fragments
  const fragmentInfos = externalFragments.map((f) => ({
    filePath: f.uri,
    content: f.content,
    definition: f.definition,
  }));

  try {
    const result = await getDefinitionQueryResultForFragmentSpread(preprocessed, fragmentSpread, fragmentInfos);

    return result.definitions.map((def): Location => {
      const defPosition = toIPosition(def.position);
      const endLine = def.range?.end?.line ?? defPosition.line;
      const endChar = def.range?.end?.character ?? defPosition.character;

      // Map GraphQL-relative positions to TS file positions for the target document
      const targetFragment = externalFragments.find((f) => f.uri === def.path);
      if (targetFragment) {
        // Convert from reconstructed-content space to original-template-content space
        const targetReconstructedLineOffsets = computeLineOffsets(targetFragment.content);
        const targetContentLineOffsets = computeLineOffsets(
          targetFragment.content.slice(targetFragment.headerLen),
        );

        const toOriginalPos = (pos: { line: number; character: number }) => {
          const offset = positionToOffset(targetReconstructedLineOffsets, pos);
          const originalOffset = Math.max(0, offset - targetFragment.headerLen);
          return offsetToPosition(targetContentLineOffsets, originalOffset);
        };

        const targetMapper = createPositionMapper({
          tsSource: targetFragment.tsSource,
          contentStartOffset: targetFragment.contentRange.start,
          graphqlContent: targetFragment.content.slice(targetFragment.headerLen),
        });
        const tsStart = targetMapper.graphqlToTs(toOriginalPos({ line: defPosition.line, character: defPosition.character }));
        const tsEnd = targetMapper.graphqlToTs(toOriginalPos({ line: endLine, character: endChar }));
        return {
          uri: def.path,
          range: { start: tsStart, end: tsEnd },
        };
      }

      return {
        uri: def.path,
        range: {
          start: { line: defPosition.line, character: defPosition.character },
          end: { line: endLine, character: endChar },
        },
      };
    });
  } catch {
    return [];
  }
};
