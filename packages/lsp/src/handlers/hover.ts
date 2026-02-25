/**
 * Hover handler: provides type information on hover in GraphQL templates.
 * @module
 */

import type { GraphQLSchema } from "graphql";
import { getHoverInformation } from "graphql-language-service";
import type { Hover, MarkupContent } from "vscode-languageserver-types";
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

export type HandleHoverInput = {
  readonly template: ExtractedTemplate;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
  /** LSP Position (0-indexed line, 0-indexed character) in the TS file. */
  readonly tsPosition: Position;
};

/** Handle a hover request for a GraphQL template. */
export const handleHover = (input: HandleHoverInput): Hover | null => {
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
    return null;
  }

  // Shift content position to reconstructed position (account for synthesized header)
  const contentLineOffsets = computeLineOffsets(template.content);
  const contentOffset = positionToOffset(contentLineOffsets, contentPos);
  const reconstructedOffset = contentOffset + headerLen;
  const reconstructedLineOffsets = computeLineOffsets(preprocessed);
  const gqlPosition = offsetToPosition(reconstructedLineOffsets, reconstructedOffset);

  const hoverInfo = getHoverInformation(schema, preprocessed, toIPosition(gqlPosition), undefined, {
    useMarkdown: true,
  });

  // getHoverInformation returns Hover['contents'] which can be string, MarkupContent, or MarkedString[]
  if (!hoverInfo || hoverInfo === "" || (Array.isArray(hoverInfo) && hoverInfo.length === 0)) {
    return null;
  }

  // Normalize to MarkupContent
  let contents: MarkupContent;
  if (typeof hoverInfo === "string") {
    contents = { kind: "markdown", value: hoverInfo };
  } else if (Array.isArray(hoverInfo)) {
    const parts = hoverInfo.map((item) => (typeof item === "string" ? item : item.value));
    contents = { kind: "markdown", value: parts.join("\n\n") };
  } else {
    contents = hoverInfo as MarkupContent;
  }

  return { contents };
};
