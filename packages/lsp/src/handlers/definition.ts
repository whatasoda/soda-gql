/**
 * Definition handler: provides go-to-definition for fragment spreads.
 * @module
 */

import { getDefinitionQueryResultForFragmentSpread } from "graphql-language-service";
import type { Location } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper, type Position, toIPosition } from "../position-mapping";
import type { ExtractedTemplate, IndexedFragment } from "../types";
import { findFragmentSpreadAtOffset, gqlPositionToOffset } from "./_utils";

export type HandleDefinitionInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  /** LSP Position (0-indexed line, 0-indexed character) in the TS file. */
  readonly tsPosition: Position;
  /** External fragment definitions for cross-file resolution. */
  readonly externalFragments: readonly IndexedFragment[];
};

/** Handle a definition request for a GraphQL template. */
export const handleDefinition = async (
  input: HandleDefinitionInput,
): Promise<Location[]> => {
  const { template, tsSource, tsPosition, externalFragments } = input;
  const { preprocessed } = preprocessFragmentArgs(template.content);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  const gqlPosition = mapper.tsToGraphql(tsPosition);
  if (!gqlPosition) {
    return [];
  }

  const offset = gqlPositionToOffset(preprocessed, gqlPosition);

  const fragmentSpread = findFragmentSpreadAtOffset(preprocessed, offset);
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
    const result = await getDefinitionQueryResultForFragmentSpread(
      preprocessed,
      fragmentSpread,
      fragmentInfos,
    );

    return result.definitions.map((def): Location => {
      const defPosition = toIPosition(def.position);
      const endLine = def.range?.end?.line ?? defPosition.line;
      const endChar = def.range?.end?.character ?? defPosition.character;

      // Map GraphQL-relative positions to TS file positions for the target document
      const targetFragment = externalFragments.find((f) => f.uri === def.path);
      if (targetFragment) {
        const targetMapper = createPositionMapper({
          tsSource: targetFragment.tsSource,
          contentStartOffset: targetFragment.contentRange.start,
          graphqlContent: targetFragment.content,
        });
        const tsStart = targetMapper.graphqlToTs({ line: defPosition.line, character: defPosition.character });
        const tsEnd = targetMapper.graphqlToTs({ line: endLine, character: endChar });
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
