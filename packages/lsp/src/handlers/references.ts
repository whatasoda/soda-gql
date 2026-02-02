/**
 * References handler: find all usages of a fragment across the workspace.
 * @module
 */

import type { Location } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, type Position, positionToOffset } from "../position-mapping";
import type { ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "../types";

import { computeFragmentDefinitionRanges, computeSpreadLocationRanges, resolveFragmentNameAtOffset } from "./_utils";

export type HandleReferencesInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  readonly tsPosition: Position;
  readonly uri: string;
  readonly allFragments: readonly IndexedFragment[];
  readonly findSpreadLocations: (fragmentName: string) => readonly FragmentSpreadLocation[];
};

/** Handle a references request for a GraphQL template. */
export const handleReferences = (input: HandleReferencesInput): Location[] => {
  const { template, tsSource, tsPosition, allFragments, findSpreadLocations } = input;
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

  const offset = positionToOffset(computeLineOffsets(preprocessed), gqlPosition);

  // Determine the fragment name at cursor
  const fragmentName = resolveFragmentNameAtOffset(preprocessed, offset);
  if (!fragmentName) {
    return [];
  }

  const locations: Location[] = [];

  // Collect fragment definition locations
  for (const r of computeFragmentDefinitionRanges(fragmentName, allFragments)) {
    locations.push({ uri: r.uri, range: r.range });
  }

  // Collect fragment spread locations
  for (const r of computeSpreadLocationRanges(findSpreadLocations(fragmentName))) {
    locations.push({ uri: r.uri, range: r.range });
  }

  return locations;
};
