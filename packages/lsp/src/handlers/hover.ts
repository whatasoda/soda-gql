/**
 * Hover handler: provides type information on hover in GraphQL templates.
 * @module
 */

import type { GraphQLSchema } from "graphql";
import { getHoverInformation } from "graphql-language-service";
import type { Hover, MarkupContent } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper, type Position, toIPosition } from "../position-mapping";
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
  const { preprocessed } = preprocessFragmentArgs(template.content);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  const gqlPosition = mapper.tsToGraphql(tsPosition);
  if (!gqlPosition) {
    return null;
  }

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
