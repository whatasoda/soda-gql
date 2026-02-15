/**
 * Preprocessor for Fragment Arguments RFC syntax.
 *
 * Strips fragment argument declarations and spread arguments by replacing
 * them with equal-length whitespace to preserve line/column alignment.
 *
 * @module
 */

/** Result of fragment arguments preprocessing. */
export type PreprocessResult = {
  /** Content with Fragment Arguments syntax replaced by whitespace. */
  readonly preprocessed: string;
  /** Whether any preprocessing was applied. */
  readonly modified: boolean;
};

/**
 * Find the matching closing parenthesis for a balanced group.
 * Handles nested parentheses, string literals, and comments.
 * Returns the index of the closing ')' or -1 if not found.
 */
const findMatchingParen = (content: string, openIndex: number): number => {
  let depth = 1;
  let inString: false | '"' | "'" = false;

  for (let i = openIndex + 1; i < content.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: Loop index is within bounds
    const ch = content[i]!;

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

/**
 * Replace a range [start, end] (inclusive) with spaces, preserving newlines.
 */
const replaceWithSpaces = (content: string, start: number, end: number): string => {
  let result = content.slice(0, start);
  for (let i = start; i <= end; i++) {
    result += content[i] === "\n" ? "\n" : " ";
  }
  result += content.slice(end + 1);
  return result;
};

// Pattern: fragment Name( at word boundary, not followed by "on"
const FRAGMENT_DEF_PATTERN = /\bfragment\s+(\w+)\s*\(/g;

// Pattern: ...FragmentName(
const FRAGMENT_SPREAD_PATTERN = /\.\.\.(\w+)\s*\(/g;

/**
 * Preprocess Fragment Arguments RFC syntax by replacing argument lists with spaces.
 *
 * Transforms:
 * - `fragment UserProfile($showEmail: Boolean = false) on User` -> `fragment UserProfile                               on User`
 * - `...UserProfile(showEmail: true)` -> `...UserProfile                  `
 */
export const preprocessFragmentArgs = (content: string): PreprocessResult => {
  let result = content;
  let modified = false;

  // Pass 1: Fragment definition arguments
  // Match "fragment Name(" and find the matching ")" to strip
  let match: RegExpExecArray | null;
  FRAGMENT_DEF_PATTERN.lastIndex = 0;
  while ((match = FRAGMENT_DEF_PATTERN.exec(result)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;

    // Check that the next non-whitespace after ")" is "on" (to distinguish from non-fragment-args parens)
    const closeParenIndex = findMatchingParen(result, openParenIndex);
    if (closeParenIndex === -1) {
      continue;
    }

    // Verify this is a fragment definition (followed by "on")
    const afterParen = result.slice(closeParenIndex + 1).trimStart();
    if (!afterParen.startsWith("on")) {
      continue;
    }

    result = replaceWithSpaces(result, openParenIndex, closeParenIndex);
    modified = true;
    // Reset regex since we modified the string (positions may shift)
    FRAGMENT_DEF_PATTERN.lastIndex = 0;
  }

  // Pass 2: Fragment spread arguments
  FRAGMENT_SPREAD_PATTERN.lastIndex = 0;
  while ((match = FRAGMENT_SPREAD_PATTERN.exec(result)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(result, openParenIndex);
    if (closeParenIndex === -1) {
      continue;
    }

    result = replaceWithSpaces(result, openParenIndex, closeParenIndex);
    modified = true;
    FRAGMENT_SPREAD_PATTERN.lastIndex = 0;
  }

  return { preprocessed: result, modified };
};
