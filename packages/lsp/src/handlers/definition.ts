/**
 * Definition handler: provides go-to-definition for fragment spreads.
 * @module
 */

import { parse, visit } from "graphql";
import type { FragmentSpreadNode } from "graphql";
import { getDefinitionQueryResultForFragmentSpread } from "graphql-language-service";
import type { Location } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper, type Position, toIPosition } from "../position-mapping";
import type { ExtractedTemplate, IndexedFragment } from "../types";

export type HandleDefinitionInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  /** LSP Position (0-indexed line, 0-indexed character) in the TS file. */
  readonly tsPosition: Position;
  /** External fragment definitions for cross-file resolution. */
  readonly externalFragments: readonly IndexedFragment[];
};

/**
 * Find the fragment spread name at the given GraphQL offset using text matching.
 * Returns the FragmentSpreadNode if cursor is on a `...FragmentName` pattern.
 */
const findFragmentSpreadAtOffset = (
  preprocessed: string,
  offset: number,
): FragmentSpreadNode | null => {
  // Try to parse and find fragment spread at offset using AST
  try {
    const ast = parse(preprocessed, { noLocation: false });
    let found: FragmentSpreadNode | null = null;

    visit(ast, {
      FragmentSpread(node) {
        if (!node.loc) {
          return;
        }
        // Check if the cursor is within this fragment spread's range
        if (offset >= node.loc.start && offset < node.loc.end) {
          found = node;
        }
      },
    });

    return found;
  } catch {
    // Parse error — fall back to text matching
    return findFragmentSpreadByText(preprocessed, offset);
  }
};

/**
 * Text-based fallback: find fragment spread name at offset.
 * Handles documents with parse errors.
 */
const findFragmentSpreadByText = (
  text: string,
  offset: number,
): FragmentSpreadNode | null => {
  const spreadPattern = /\.\.\.([A-Za-z_]\w*)/g;
  let match: RegExpExecArray | null = null;

  while ((match = spreadPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset < end) {
      // Create a minimal FragmentSpreadNode-like object
      return {
        kind: "FragmentSpread" as const,
        name: { kind: "Name" as const, value: match[1]! },
      } as FragmentSpreadNode;
    }
  }

  return null;
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

  // Convert GraphQL position to offset for node lookup
  const lines = preprocessed.split("\n");
  let offset = 0;
  for (let i = 0; i < gqlPosition.line; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for newline
  }
  offset += gqlPosition.character;

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
      return {
        uri: def.path,
        range: {
          start: { line: defPosition.line, character: defPosition.character },
          end: {
            line: def.range?.end?.line ?? defPosition.line,
            character: def.range?.end?.character ?? defPosition.character,
          },
        },
      };
    });
  } catch {
    return [];
  }
};
