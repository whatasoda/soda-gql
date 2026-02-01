/**
 * Bidirectional position mapping between TypeScript file and GraphQL content.
 * @module
 */

/** 0-indexed line and character position. */
export type Position = {
  readonly line: number;
  readonly character: number;
};

export type PositionMapper = {
  /** Map TS file position to GraphQL content position. Returns null if outside template. */
  readonly tsToGraphql: (tsPosition: Position) => Position | null;
  /** Map GraphQL content position back to TS file position. */
  readonly graphqlToTs: (gqlPosition: Position) => Position;
};

export type PositionMapperInput = {
  readonly tsSource: string;
  /** Byte offset of the first character of GraphQL content (after opening backtick). */
  readonly contentStartOffset: number;
  readonly graphqlContent: string;
};

/** Compute byte offsets for the start of each line in the source text. */
export const computeLineOffsets = (source: string): readonly number[] => {
  const offsets: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      // newline
      offsets.push(i + 1);
    }
  }
  return offsets;
};

/** Convert a Position to a byte offset within the source text. */
export const positionToOffset = (lineOffsets: readonly number[], position: Position): number => {
  if (position.line < 0 || position.line >= lineOffsets.length) {
    return -1;
  }
  return lineOffsets[position.line]! + position.character;
};

/** Convert a byte offset to a Position within the source text. */
export const offsetToPosition = (lineOffsets: readonly number[], offset: number): Position => {
  // Binary search for the line containing the offset
  let low = 0;
  let high = lineOffsets.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineOffsets[mid]! <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { line: low, character: offset - lineOffsets[low]! };
};

/** Convert a Position to an IPosition compatible with graphql-language-service. */
export const toIPosition = (pos: Position): { line: number; character: number; setLine: (l: number) => void; setCharacter: (c: number) => void; lessThanOrEqualTo: (other: Position) => boolean } => {
  const p = { line: pos.line, character: pos.character, setLine: (l: number) => { p.line = l; }, setCharacter: (c: number) => { p.character = c; }, lessThanOrEqualTo: (other: Position) => p.line < other.line || (p.line === other.line && p.character <= other.character) };
  return p;
};

/** Create a bidirectional position mapper between TS file and GraphQL content. */
export const createPositionMapper = (input: PositionMapperInput): PositionMapper => {
  const { tsSource, contentStartOffset, graphqlContent } = input;
  const tsLineOffsets = computeLineOffsets(tsSource);
  const gqlLineOffsets = computeLineOffsets(graphqlContent);

  return {
    tsToGraphql: (tsPosition) => {
      const tsOffset = positionToOffset(tsLineOffsets, tsPosition);
      if (tsOffset < 0) {
        return null;
      }
      const gqlOffset = tsOffset - contentStartOffset;
      if (gqlOffset < 0 || gqlOffset > graphqlContent.length) {
        return null;
      }
      return offsetToPosition(gqlLineOffsets, gqlOffset);
    },

    graphqlToTs: (gqlPosition) => {
      const gqlOffset = positionToOffset(gqlLineOffsets, gqlPosition);
      const tsOffset = gqlOffset + contentStartOffset;
      return offsetToPosition(tsLineOffsets, tsOffset);
    },
  };
};
