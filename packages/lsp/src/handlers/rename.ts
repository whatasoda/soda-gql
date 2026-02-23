/**
 * Rename handler: rename fragments across the workspace.
 * @module
 */

import type { Range, TextEdit, WorkspaceEdit } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition, type Position, positionToOffset } from "../position-mapping";
import type { ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "../types";
import {
  computeFragmentDefinitionRanges,
  computeSpreadLocationRanges,
  findFragmentDefinitionAtOffset,
  findFragmentSpreadAtOffset,
  resolveFragmentNameAtOffset,
} from "./_utils";

export type HandlePrepareRenameInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  readonly tsPosition: Position;
};

export type HandleRenameInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  readonly tsPosition: Position;
  readonly newName: string;
  readonly allFragments: readonly IndexedFragment[];
  readonly findSpreadLocations: (fragmentName: string) => readonly FragmentSpreadLocation[];
};

/** Validate and return the range of the symbol to be renamed. */
export const handlePrepareRename = (input: HandlePrepareRenameInput): { range: Range; placeholder: string } | null => {
  const { template, tsSource, tsPosition } = input;
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

  const offset = positionToOffset(computeLineOffsets(preprocessed), gqlPosition);

  // Check fragment definition name
  const defResult = findFragmentDefinitionAtOffset(preprocessed, offset);
  if (defResult) {
    const gqlLineOffsets = computeLineOffsets(preprocessed);
    const start = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, defResult.loc.start));
    const end = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, defResult.loc.end));
    return { range: { start, end }, placeholder: defResult.name };
  }

  // Check fragment spread
  const spread = findFragmentSpreadAtOffset(preprocessed, offset);
  if (spread?.name.value && spread.name.loc) {
    const gqlLineOffsets = computeLineOffsets(preprocessed);
    const start = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, spread.name.loc.start));
    const end = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, spread.name.loc.end));
    return { range: { start, end }, placeholder: spread.name.value };
  }

  return null;
};

/** Perform a rename across the workspace. */
export const handleRename = (input: HandleRenameInput): WorkspaceEdit | null => {
  const { template, tsSource, tsPosition, newName, allFragments, findSpreadLocations } = input;
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

  const offset = positionToOffset(computeLineOffsets(preprocessed), gqlPosition);

  // Determine the fragment name at cursor
  const fragmentName = resolveFragmentNameAtOffset(preprocessed, offset);
  if (!fragmentName) {
    return null;
  }

  const changes: Record<string, TextEdit[]> = {};

  const addEdit = (uri: string, range: Range, text: string): void => {
    if (!changes[uri]) {
      changes[uri] = [];
    }
    changes[uri].push({ range, newText: text });
  };

  // Rename fragment definitions
  for (const r of computeFragmentDefinitionRanges(fragmentName, allFragments)) {
    addEdit(r.uri, r.range, newName);
  }

  // Rename fragment spreads
  for (const r of computeSpreadLocationRanges(findSpreadLocations(fragmentName))) {
    addEdit(r.uri, r.range, newName);
  }

  if (Object.keys(changes).length === 0) {
    return null;
  }

  return { changes };
};
