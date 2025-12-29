/**
 * The newline string to insert after object opening brace
 */
export const NEWLINE_INSERTION = "\n";

/**
 * Check if there's already a newline after the opening brace.
 * Uses string inspection rather than AST.
 *
 * @param source - The source code string
 * @param objectStartPos - The position of the `{` character in the source
 */
export const hasExistingNewline = (source: string, objectStartPos: number): boolean => {
  // Skip the `{` character
  const pos = objectStartPos + 1;

  // Check if next character is a newline
  const nextChar = source[pos];
  return nextChar === "\n" || nextChar === "\r";
};
