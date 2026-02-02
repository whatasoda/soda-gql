/**
 * References handler: find all usages of a fragment across the workspace.
 * @module
 */

import type { Location } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition, type Position } from "../position-mapping";
import type { ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "../types";
import { gqlPositionToOffset, resolveFragmentNameAtOffset } from "./_utils";

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

  const offset = gqlPositionToOffset(preprocessed, gqlPosition);

  // Determine the fragment name at cursor
  const fragmentName = resolveFragmentNameAtOffset(preprocessed, offset);
  if (!fragmentName) {
    return [];
  }

  const locations: Location[] = [];

  // Collect fragment definition locations
  for (const frag of allFragments) {
    if (frag.fragmentName !== fragmentName) {
      continue;
    }
    if (!frag.definition.name.loc) {
      continue;
    }

    const defMapper = createPositionMapper({
      tsSource: frag.tsSource,
      contentStartOffset: frag.contentRange.start,
      graphqlContent: frag.content,
    });

    const defGqlLineOffsets = computeLineOffsets(frag.content);
    const nameStart = offsetToPosition(defGqlLineOffsets, frag.definition.name.loc.start);
    const nameEnd = offsetToPosition(defGqlLineOffsets, frag.definition.name.loc.end);

    locations.push({
      uri: frag.uri,
      range: {
        start: defMapper.graphqlToTs(nameStart),
        end: defMapper.graphqlToTs(nameEnd),
      },
    });
  }

  // Collect fragment spread locations
  const spreadLocations = findSpreadLocations(fragmentName);
  for (const loc of spreadLocations) {
    const spreadMapper = createPositionMapper({
      tsSource: loc.tsSource,
      contentStartOffset: loc.template.contentRange.start,
      graphqlContent: loc.template.content,
    });

    const spreadGqlLineOffsets = computeLineOffsets(loc.template.content);
    const spreadStart = offsetToPosition(spreadGqlLineOffsets, loc.nameOffset);
    const spreadEnd = offsetToPosition(spreadGqlLineOffsets, loc.nameOffset + loc.nameLength);

    locations.push({
      uri: loc.uri,
      range: {
        start: spreadMapper.graphqlToTs(spreadStart),
        end: spreadMapper.graphqlToTs(spreadEnd),
      },
    });
  }

  return locations;
};
