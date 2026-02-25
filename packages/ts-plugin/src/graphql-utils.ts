/**
 * GraphQL utilities copied from @soda-gql/lsp for use in the TS plugin.
 *
 * These are duplicated (not shared) per VISION.md decision:
 * "Copy shared logic: the code is ~230 lines total; shared package adds
 * complexity without proportional benefit at this stage."
 *
 * @module
 */
import type { TemplateInfo } from "./template-detector";

// ============================================================================
// reconstructGraphql (from packages/lsp/src/document-manager.ts)
// ============================================================================

/**
 * Reconstruct full GraphQL source from template info.
 * Prepends the definition header from curried tag call arguments.
 */
export const reconstructGraphql = (info: TemplateInfo): string => {
  const content = info.content;

  if (info.elementName) {
    if (info.kind === "fragment" && info.typeName) {
      return `fragment ${info.elementName} on ${info.typeName} ${content}`;
    }
    return `${info.kind} ${info.elementName} ${content}`;
  }

  return content;
};

// ============================================================================
// preprocessFragmentArgs (from packages/lsp/src/fragment-args-preprocessor.ts)
// ============================================================================

/** Find the matching closing parenthesis for a balanced group. */
const findMatchingParen = (content: string, openIndex: number): number => {
  let depth = 1;
  let inString: false | '"' | "'" = false;

  for (let i = openIndex + 1; i < content.length; i++) {
    const ch = content[i];
    if (ch === undefined) break;

    if (inString) {
      if (ch === inString) {
        let backslashes = 0;
        for (let j = i - 1; j >= 0 && content[j] === "\\"; j--) {
          backslashes++;
        }
        if (backslashes % 2 === 0) {
          inString = false;
        }
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
};

/** Replace a range [start, end] (inclusive) with spaces, preserving newlines. */
const replaceWithSpaces = (content: string, start: number, end: number): string => {
  let result = content.slice(0, start);
  for (let i = start; i <= end; i++) {
    result += content[i] === "\n" ? "\n" : " ";
  }
  result += content.slice(end + 1);
  return result;
};

const FRAGMENT_DEF_PATTERN = /\bfragment\s+(\w+)\s*\(/g;
const FRAGMENT_DEF_CURRIED_PATTERN = /\bfragment\s+\w+\s+on\s+\w+\s*\(/g;
const FRAGMENT_SPREAD_PATTERN = /\.\.\.(\w+)\s*\(/g;

/** Preprocess Fragment Arguments RFC syntax by replacing argument lists with spaces. */
export const preprocessFragmentArgs = (content: string): string => {
  let result = content;

  let match: RegExpExecArray | null;
  FRAGMENT_DEF_PATTERN.lastIndex = 0;
  while ((match = FRAGMENT_DEF_PATTERN.exec(result)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(result, openParenIndex);
    if (closeParenIndex === -1) continue;

    const afterParen = result.slice(closeParenIndex + 1).trimStart();
    if (!afterParen.startsWith("on")) continue;

    result = replaceWithSpaces(result, openParenIndex, closeParenIndex);
    FRAGMENT_DEF_PATTERN.lastIndex = 0;
  }

  FRAGMENT_DEF_CURRIED_PATTERN.lastIndex = 0;
  while ((match = FRAGMENT_DEF_CURRIED_PATTERN.exec(result)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(result, openParenIndex);
    if (closeParenIndex === -1) continue;

    const afterParen = result.slice(closeParenIndex + 1).trimStart();
    if (!afterParen.startsWith("{")) continue;

    result = replaceWithSpaces(result, openParenIndex, closeParenIndex);
    FRAGMENT_DEF_CURRIED_PATTERN.lastIndex = 0;
  }

  FRAGMENT_SPREAD_PATTERN.lastIndex = 0;
  while ((match = FRAGMENT_SPREAD_PATTERN.exec(result)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(result, openParenIndex);
    if (closeParenIndex === -1) continue;

    result = replaceWithSpaces(result, openParenIndex, closeParenIndex);
    FRAGMENT_SPREAD_PATTERN.lastIndex = 0;
  }

  return result;
};

// ============================================================================
// Position mapping (from packages/lsp/src/position-mapping.ts)
// ============================================================================

/** Compute byte offsets for the start of each line in the source text. */
export const computeLineOffsets = (source: string): readonly number[] => {
  const offsets: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      offsets.push(i + 1);
    }
  }
  return offsets;
};

/** Convert a byte offset to a 0-indexed line/character position. */
export const offsetToPosition = (lineOffsets: readonly number[], offset: number): { line: number; character: number } => {
  let low = 0;
  let high = lineOffsets.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((lineOffsets[mid] ?? 0) <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { line: low, character: offset - (lineOffsets[low] ?? 0) };
};

/** Convert a Position to an IPosition compatible with graphql-language-service. */
export const toIPosition = (pos: {
  line: number;
  character: number;
}): {
  line: number;
  character: number;
  setLine: (l: number) => void;
  setCharacter: (c: number) => void;
  lessThanOrEqualTo: (other: { line: number; character: number }) => boolean;
} => {
  const p = {
    line: pos.line,
    character: pos.character,
    setLine: (l: number) => {
      p.line = l;
    },
    setCharacter: (c: number) => {
      p.character = c;
    },
    lessThanOrEqualTo: (other: { line: number; character: number }) =>
      p.line < other.line || (p.line === other.line && p.character <= other.character),
  };
  return p;
};
