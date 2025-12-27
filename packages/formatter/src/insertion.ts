/**
 * The empty comment string to insert after array opening bracket
 */
export const EMPTY_COMMENT_INSERTION = "\n//\n";

/**
 * Check if there's already an empty line comment after the opening bracket.
 * Uses string inspection rather than AST comments.
 *
 * @param source - The source code string
 * @param arrayStartPos - The position of the `[` character in the source
 */
export const hasExistingEmptyComment = (source: string, arrayStartPos: number): boolean => {
  // Skip the `[` character
  let pos = arrayStartPos + 1;

  // Skip whitespace (spaces, tabs, newlines)
  while (pos < source.length && /\s/.test(source[pos] ?? "")) {
    pos++;
  }

  // Check if next characters are `//`
  if (source.slice(pos, pos + 2) !== "//") {
    return false;
  }

  // Check if it's an empty comment (only whitespace until newline)
  const endOfLine = source.indexOf("\n", pos + 2);
  if (endOfLine === -1) {
    // Comment at end of file - consider it empty
    return source.slice(pos + 2).trim() === "";
  }

  const commentContent = source.slice(pos + 2, endOfLine).trim();
  return commentContent === "";
};
