/**
 * Shared handler utilities for fragment spread and definition lookup.
 * @module
 */

import type { FragmentSpreadNode } from "graphql";
import { parse, visit } from "graphql";
import { computeLineOffsets, createPositionMapper, offsetToPosition, type Position } from "../position-mapping";
import type { FragmentSpreadLocation, IndexedFragment } from "../types";

/**
 * Find the fragment spread node at the given GraphQL offset using AST.
 * Returns the FragmentSpreadNode if cursor is on a `...FragmentName` pattern.
 */
export const findFragmentSpreadAtOffset = (preprocessed: string, offset: number): FragmentSpreadNode | null => {
  try {
    const ast = parse(preprocessed, { noLocation: false });
    let found: FragmentSpreadNode | null = null;

    visit(ast, {
      FragmentSpread(node) {
        if (!node.loc) {
          return;
        }
        if (offset >= node.loc.start && offset < node.loc.end) {
          found = node;
        }
      },
    });

    return found;
  } catch {
    return findFragmentSpreadByText(preprocessed, offset);
  }
};

/**
 * Text-based fallback: find fragment spread name at offset.
 * Handles documents with parse errors.
 */
export const findFragmentSpreadByText = (text: string, offset: number): FragmentSpreadNode | null => {
  const spreadPattern = /\.\.\.([A-Za-z_]\w*)/g;
  let match: RegExpExecArray | null = null;

  while ((match = spreadPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset < end) {
      return {
        kind: "FragmentSpread" as const,
        name: { kind: "Name" as const, value: match[1]! },
      } as FragmentSpreadNode;
    }
  }

  return null;
};

export type FragmentDefinitionMatch = {
  readonly name: string;
  readonly loc: { readonly start: number; readonly end: number };
};

/**
 * Find a FragmentDefinition at a given offset.
 * Returns the name and location, or null.
 */
export const findFragmentDefinitionAtOffset = (preprocessed: string, offset: number): FragmentDefinitionMatch | null => {
  try {
    const ast = parse(preprocessed, { noLocation: false });
    for (const def of ast.definitions) {
      if (def.kind === "FragmentDefinition" && def.name.loc) {
        if (offset >= def.name.loc.start && offset < def.name.loc.end) {
          return { name: def.name.value, loc: { start: def.name.loc.start, end: def.name.loc.end } };
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

/**
 * Resolve the fragment name at a given offset, checking both definitions and spreads.
 */
export const resolveFragmentNameAtOffset = (preprocessed: string, offset: number): string | null => {
  const def = findFragmentDefinitionAtOffset(preprocessed, offset);
  if (def) {
    return def.name;
  }

  const spread = findFragmentSpreadAtOffset(preprocessed, offset);
  if (spread) {
    return spread.name.value;
  }

  return null;
};

/** Range result from fragment location computation. */
export type FragmentRange = {
  readonly uri: string;
  readonly range: { readonly start: Position; readonly end: Position };
};

/** Compute TS ranges for all definitions of a named fragment. */
export const computeFragmentDefinitionRanges = (
  fragmentName: string,
  allFragments: readonly IndexedFragment[],
): FragmentRange[] => {
  const ranges: FragmentRange[] = [];

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

    ranges.push({
      uri: frag.uri,
      range: {
        start: defMapper.graphqlToTs(nameStart),
        end: defMapper.graphqlToTs(nameEnd),
      },
    });
  }

  return ranges;
};

/** Compute TS ranges for all fragment spread locations. */
export const computeSpreadLocationRanges = (spreadLocations: readonly FragmentSpreadLocation[]): FragmentRange[] => {
  const ranges: FragmentRange[] = [];

  for (const loc of spreadLocations) {
    const spreadMapper = createPositionMapper({
      tsSource: loc.tsSource,
      contentStartOffset: loc.template.contentRange.start,
      graphqlContent: loc.template.content,
    });

    const spreadGqlLineOffsets = computeLineOffsets(loc.template.content);
    const spreadStart = offsetToPosition(spreadGqlLineOffsets, loc.nameOffset);
    const spreadEnd = offsetToPosition(spreadGqlLineOffsets, loc.nameOffset + loc.nameLength);

    ranges.push({
      uri: loc.uri,
      range: {
        start: spreadMapper.graphqlToTs(spreadStart),
        end: spreadMapper.graphqlToTs(spreadEnd),
      },
    });
  }

  return ranges;
};
